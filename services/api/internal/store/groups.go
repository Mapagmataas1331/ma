package store

import (
	"context"

	"github.com/google/uuid"
)

const MaxGroupMembers = 20

type Member struct {
	ID          uuid.UUID
	Username    string
	DisplayName string
	Role        string
}

func (s *Store) Members(ctx context.Context, conversation, viewer uuid.UUID) ([]Member, error) {
	rows, err := s.Pool.Query(ctx, `SELECT u.id, u.username, u.display_name, m.role
		FROM conversation_members m
		JOIN users u ON u.id=m.user_id
		WHERE m.conversation_id=$1 AND m.left_at IS NULL
		AND EXISTS(SELECT 1 FROM conversation_members me WHERE me.conversation_id=$1 AND me.user_id=$2 AND me.left_at IS NULL)
		ORDER BY u.username`, conversation, viewer)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) MemberRole(ctx context.Context, conversation, user uuid.UUID) (string, error) {
	var role string
	err := s.Pool.QueryRow(ctx, `SELECT role FROM conversation_members WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`, conversation, user).Scan(&role)
	if err != nil {
		return "", ErrNotFound
	}
	return role, nil
}

func (s *Store) CreateGroup(ctx context.Context, owner uuid.UUID, title string, memberIDs []uuid.UUID) (Conversation, error) {
	seen := map[uuid.UUID]struct{}{owner: {}}
	var members []uuid.UUID
	for _, id := range memberIDs {
		if id == owner {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		members = append(members, id)
	}
	if len(seen) > MaxGroupMembers {
		return Conversation{}, ErrForbidden
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Conversation{}, err
	}
	defer tx.Rollback(ctx)
	for _, id := range members {
		var accepted bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM contacts WHERE owner_id=$1 AND contact_id=$2 AND state='accepted')`, owner, id).Scan(&accepted); err != nil {
			return Conversation{}, err
		}
		if !accepted {
			return Conversation{}, ErrForbidden
		}
	}
	var id uuid.UUID
	if err = tx.QueryRow(ctx, `INSERT INTO conversations (kind, created_by, title, membership_version) VALUES ('group',$1,$2,1) RETURNING id`, owner, title).Scan(&id); err != nil {
		return Conversation{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1,$2,'owner')`, id, owner); err != nil {
		return Conversation{}, err
	}
	for _, member := range members {
		if _, err = tx.Exec(ctx, `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1,$2,'member')`, id, member); err != nil {
			return Conversation{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Conversation{}, err
	}
	return Conversation{ID: id, Kind: "group", Title: title, Version: 1, PeerID: owner}, nil
}

func (s *Store) AddMember(ctx context.Context, conversation, actor, member uuid.UUID) error {
	role, err := s.MemberRole(ctx, conversation, actor)
	if err != nil || (role != "owner" && role != "admin") {
		return ErrForbidden
	}
	var n int
	if err = s.Pool.QueryRow(ctx, `SELECT count(*) FROM conversation_members WHERE conversation_id=$1 AND left_at IS NULL`, conversation).Scan(&n); err != nil {
		return err
	}
	if n >= MaxGroupMembers {
		return ErrForbidden
	}
	tag, err := s.Pool.Exec(ctx, `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1,$2,'member')
		ON CONFLICT (conversation_id, user_id) DO UPDATE SET role='member', left_at=NULL, joined_at=now()
		WHERE conversation_members.left_at IS NOT NULL`, conversation, member)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrForbidden
	}
	_, err = s.Pool.Exec(ctx, `UPDATE conversations SET membership_version=membership_version+1 WHERE id=$1 AND kind='group'`, conversation)
	return err
}

func (s *Store) RemoveMember(ctx context.Context, conversation, actor, member uuid.UUID) error {
	role, err := s.MemberRole(ctx, conversation, actor)
	if err != nil || (role != "owner" && role != "admin") || actor == member {
		return ErrForbidden
	}
	var target string
	if err = s.Pool.QueryRow(ctx, `SELECT role FROM conversation_members WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`, conversation, member).Scan(&target); err != nil {
		return ErrNotFound
	}
	if target == "owner" || (role == "admin" && target == "admin") {
		return ErrForbidden
	}
	tag, err := s.Pool.Exec(ctx, `UPDATE conversation_members SET left_at=now() WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`, conversation, member)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrNotFound
	}
	_, err = s.Pool.Exec(ctx, `UPDATE conversations SET membership_version=membership_version+1 WHERE id=$1`, conversation)
	return err
}

func (s *Store) LeaveConversation(ctx context.Context, conversation, user uuid.UUID) error {
	role, err := s.MemberRole(ctx, conversation, user)
	if err != nil {
		return ErrNotFound
	}
	if role == "owner" {
		var others int
		_ = s.Pool.QueryRow(ctx, `SELECT count(*) FROM conversation_members WHERE conversation_id=$1 AND user_id<>$2 AND left_at IS NULL`, conversation, user).Scan(&others)
		if others > 0 {
			return ErrForbidden
		}
	}
	_, err = s.Pool.Exec(ctx, `UPDATE conversation_members SET left_at=now() WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`, conversation, user)
	if err != nil {
		return err
	}
	_, err = s.Pool.Exec(ctx, `UPDATE conversations SET membership_version=membership_version+1 WHERE id=$1`, conversation)
	return err
}

func (s *Store) RenameConversation(ctx context.Context, conversation, actor uuid.UUID, title string) error {
	role, err := s.MemberRole(ctx, conversation, actor)
	if err != nil || (role != "owner" && role != "admin") {
		return ErrForbidden
	}
	tag, err := s.Pool.Exec(ctx, `UPDATE conversations SET title=$3, membership_version=membership_version+1 WHERE id=$1 AND kind='group' AND EXISTS(
		SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL)`, conversation, actor, title)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) TransferOwnership(ctx context.Context, conversation, owner, next uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE conversation_members SET role='admin' WHERE conversation_id=$1 AND user_id=$2 AND role='owner' AND left_at IS NULL`, conversation, owner)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrForbidden
	}
	tag, err = tx.Exec(ctx, `UPDATE conversation_members SET role='owner' WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL AND role<>'owner'`, conversation, next)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `UPDATE conversations SET membership_version=membership_version+1 WHERE id=$1 AND kind='group'`, conversation); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteConversation(ctx context.Context, conversation, owner uuid.UUID) error {
	role, err := s.MemberRole(ctx, conversation, owner)
	if err != nil || role != "owner" {
		return ErrForbidden
	}
	_, err = s.Pool.Exec(ctx, `UPDATE conversation_members SET left_at=now() WHERE conversation_id=$1 AND left_at IS NULL`, conversation)
	return err
}
