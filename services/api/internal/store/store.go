package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Pool *pgxpool.Pool
}

func Open(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

type User struct {
	ID          uuid.UUID
	Username    string
	DisplayName string
	Email       *string
	Password    string
	Disabled    *time.Time
	Ed25519     []byte
	X25519      []byte
	TOTP        bool
}

func (s *Store) CreateUser(ctx context.Context, username, display, hash string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `INSERT INTO users (username, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id, username, display_name`, username, display, hash).Scan(&u.ID, &u.Username, &u.DisplayName)
	return u, err
}

func (s *Store) UserByName(ctx context.Context, username string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `SELECT id, username, display_name, email, password_hash, disabled_at, identity_pk_ed25519, identity_pk_x25519,
		EXISTS(SELECT 1 FROM totp_credentials t WHERE t.user_id = users.id AND t.confirmed_at IS NOT NULL)
		FROM users WHERE username = $1`, username).Scan(&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.Password, &u.Disabled, &u.Ed25519, &u.X25519, &u.TOTP)
	return u, err
}

func (s *Store) UserByID(ctx context.Context, id uuid.UUID) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `SELECT id, username, display_name, email, password_hash, disabled_at, identity_pk_ed25519, identity_pk_x25519,
		EXISTS(SELECT 1 FROM totp_credentials t WHERE t.user_id = users.id AND t.confirmed_at IS NOT NULL)
		FROM users WHERE id = $1`, id).Scan(&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.Password, &u.Disabled, &u.Ed25519, &u.X25519, &u.TOTP)
	return u, err
}

func (s *Store) SetPassword(ctx context.Context, id uuid.UUID, hash string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET password_hash=$2, password_changed_at=now() WHERE id=$1`, id, hash)
	return err
}

func (s *Store) DisableUser(ctx context.Context, username string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET disabled_at=now() WHERE username=$1`, username)
	return err
}

func (s *Store) SetIdentity(ctx context.Context, id uuid.UUID, ed, x []byte) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET identity_pk_ed25519=$2, identity_pk_x25519=$3, identity_pk_updated_at=now() WHERE id=$1`, id, ed, x)
	return err
}

func (s *Store) ConsumeInvite(ctx context.Context, hash []byte) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE invites SET uses = uses + 1 WHERE code_hash=$1 AND uses < max_uses AND expires_at > now()`, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return errors.New("invite_invalid")
	}
	return nil
}

func InviteBadges(n int) []string {
	var out []string
	if n >= 1 {
		out = append(out, "introducer")
	}
	if n >= 3 {
		out = append(out, "connector")
	}
	if n >= 10 {
		out = append(out, "host")
	}
	if n >= 25 {
		out = append(out, "circle")
	}
	return out
}

type Invitee struct {
	Username    string
	DisplayName string
	CreatedAt   time.Time
}

type AccountInvites struct {
	Credits int
	Invited int
	Badges  []string
	People  []Invitee
}

type PublicProfile struct {
	Username    string
	DisplayName string
	CreatedAt   time.Time
	Invited     int
	Badges      []string
}

func (s *Store) RegisterWithInvite(ctx context.Context, codeHash []byte, username, display, passHash string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var inviter *uuid.UUID
	err = tx.QueryRow(ctx, `UPDATE invites SET uses = uses + 1 WHERE code_hash=$1 AND uses < max_uses AND expires_at > now() RETURNING created_by`, codeHash).Scan(&inviter)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("invite_invalid")
		}
		return err
	}
	var userID uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO users (username, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id`, username, display, passHash).Scan(&userID)
	if err != nil {
		return err
	}
	if inviter != nil {
		if _, err = tx.Exec(ctx, `INSERT INTO invite_redemptions (invitee_id, inviter_id) VALUES ($1,$2)`, userID, *inviter); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE users SET invite_credits = invite_credits + 1 WHERE id=$1`, *inviter); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO contacts (owner_id, contact_id, state) VALUES ($1,$2,'accepted'),($2,$1,'accepted') ON CONFLICT (owner_id, contact_id) DO UPDATE SET state='accepted'`, userID, *inviter); err != nil {
			return err
		}
		if _, err = directConversation(ctx, tx, *inviter, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateUserInvite(ctx context.Context, userID uuid.UUID, hash []byte, expires time.Time) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE users SET invite_credits = invite_credits - 1 WHERE id=$1 AND invite_credits > 0`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return errors.New("no_invites")
	}
	if _, err = tx.Exec(ctx, `INSERT INTO invites (code_hash, max_uses, expires_at, created_by) VALUES ($1,1,$2,$3)`, hash, expires, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) AccountInvites(ctx context.Context, userID uuid.UUID) (AccountInvites, error) {
	var out AccountInvites
	err := s.Pool.QueryRow(ctx, `SELECT invite_credits, (SELECT count(*) FROM invite_redemptions WHERE inviter_id=$1) FROM users WHERE id=$1`, userID).Scan(&out.Credits, &out.Invited)
	if err != nil {
		return out, err
	}
	out.Badges = InviteBadges(out.Invited)
	rows, err := s.Pool.Query(ctx, `SELECT u.username, u.display_name, r.created_at FROM invite_redemptions r JOIN users u ON u.id=r.invitee_id WHERE r.inviter_id=$1 ORDER BY r.created_at DESC`, userID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var person Invitee
		if err := rows.Scan(&person.Username, &person.DisplayName, &person.CreatedAt); err != nil {
			return out, err
		}
		out.People = append(out.People, person)
	}
	return out, rows.Err()
}

func (s *Store) ProfileByName(ctx context.Context, username string) (PublicProfile, error) {
	var out PublicProfile
	err := s.Pool.QueryRow(ctx, `SELECT username, display_name, created_at, (SELECT count(*) FROM invite_redemptions WHERE inviter_id=users.id) FROM users WHERE username=$1 AND disabled_at IS NULL`, username).Scan(&out.Username, &out.DisplayName, &out.CreatedAt, &out.Invited)
	if err != nil {
		return out, err
	}
	out.Badges = InviteBadges(out.Invited)
	return out, nil
}

type OpenInvite struct {
	ID        uuid.UUID
	ExpiresAt time.Time
	CreatedAt time.Time
}

func (s *Store) OpenInvites(ctx context.Context, userID uuid.UUID) ([]OpenInvite, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, expires_at, created_at FROM invites WHERE created_by=$1 AND uses < max_uses AND expires_at > now() ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OpenInvite
	for rows.Next() {
		var item OpenInvite
		if err := rows.Scan(&item.ID, &item.ExpiresAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Store) RevokeInvite(ctx context.Context, userID, inviteID uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `DELETE FROM invites WHERE id=$1 AND created_by=$2 AND uses=0`, inviteID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return errors.New("not_unused")
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET invite_credits = invite_credits + 1 WHERE id=$1`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateInvite(ctx context.Context, hash []byte, uses int, expires time.Time) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO invites (code_hash, max_uses, expires_at) VALUES ($1,$2,$3)`, hash, uses, expires)
	return err
}

type Device struct {
	ID       uuid.UUID
	UserID   uuid.UUID
	Name     string
	Platform string
	Trust    string
	LastSeen *time.Time
	Ed       []byte
	X        []byte
}

func (s *Store) UpsertDevice(ctx context.Context, userID uuid.UUID, name, platform string, ed, x []byte, first bool) (Device, error) {
	trust := "pending"
	if first {
		trust = "trusted"
	}
	var d Device
	err := s.Pool.QueryRow(ctx, `INSERT INTO devices (user_id, name, platform, device_pk_ed25519, device_pk_x25519, trust_state, last_seen_at)
		VALUES ($1,$2,$3,$4,$5,$6,now())
		ON CONFLICT (user_id, device_pk_ed25519) DO UPDATE SET name=EXCLUDED.name, platform=EXCLUDED.platform, last_seen_at=now()
		RETURNING id, user_id, name, platform, trust_state, last_seen_at`, userID, name, platform, ed, x, trust).Scan(&d.ID, &d.UserID, &d.Name, &d.Platform, &d.Trust, &d.LastSeen)
	return d, err
}

func (s *Store) TrustedDeviceCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM devices WHERE user_id=$1 AND trust_state='trusted' AND revoked_at IS NULL`, userID).Scan(&n)
	return n, err
}

func (s *Store) Devices(ctx context.Context, userID uuid.UUID) ([]Device, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, user_id, name, platform, trust_state, last_seen_at FROM devices WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Platform, &d.Trust, &d.LastSeen); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) RevokeDevice(ctx context.Context, id uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE devices SET trust_state='revoked', revoked_at=now() WHERE id=$1`, id)
	return err
}

func (s *Store) TrustDevice(ctx context.Context, id, by uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE devices SET trust_state='trusted', trusted_by_device_id=$2, revoked_at=NULL WHERE id=$1`, id, by)
	return err
}

func (s *Store) CreateSession(ctx context.Context, hash []byte, userID uuid.UUID, deviceID *uuid.UUID, expires time.Time, ip, ua string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO sessions (token_hash, user_id, device_id, expires_at, ip, user_agent) VALUES ($1,$2,$3,$4,NULLIF($5,'')::inet,$6)`, hash, userID, deviceID, expires, ip, ua)
	return err
}

type Session struct {
	ID       uuid.UUID
	UserID   uuid.UUID
	DeviceID *uuid.UUID
	Expires  time.Time
	Revoked  *time.Time
}

func (s *Store) SessionByHash(ctx context.Context, hash []byte) (Session, error) {
	var sess Session
	err := s.Pool.QueryRow(ctx, `SELECT id, user_id, device_id, expires_at, revoked_at FROM sessions WHERE token_hash=$1`, hash).Scan(&sess.ID, &sess.UserID, &sess.DeviceID, &sess.Expires, &sess.Revoked)
	return sess, err
}

func (s *Store) RevokeSessionHash(ctx context.Context, hash []byte) error {
	_, err := s.Pool.Exec(ctx, `UPDATE sessions SET revoked_at=now() WHERE token_hash=$1`, hash)
	return err
}

func (s *Store) TouchSession(ctx context.Context, id uuid.UUID, expires time.Time) error {
	_, err := s.Pool.Exec(ctx, `UPDATE sessions SET last_seen_at=now(), expires_at=$2 WHERE id=$1`, id, expires)
	return err
}

func (s *Store) Event(ctx context.Context, user *uuid.UUID, kind, ip, ua string) {
	_, _ = s.Pool.Exec(ctx, `INSERT INTO security_events (user_id, kind, ip, user_agent) VALUES ($1,$2,NULLIF($3,'')::inet,$4)`, user, kind, ip, ua)
}

func (s *Store) AddContact(ctx context.Context, owner, contact uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO contacts (owner_id, contact_id, state) VALUES ($1,$2,'requested') ON CONFLICT DO NOTHING`, owner, contact)
	return err
}

type Contact struct {
	ID          uuid.UUID
	Username    string
	DisplayName string
	State       string
}

func (s *Store) Contacts(ctx context.Context, owner uuid.UUID) ([]Contact, error) {
	rows, err := s.Pool.Query(ctx, `SELECT u.id, u.username, u.display_name, c.state FROM contacts c JOIN users u ON u.id=c.contact_id WHERE c.owner_id=$1`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Contact
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.Username, &c.DisplayName, &c.State); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) AcceptContact(ctx context.Context, owner, contact uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE contacts SET state='accepted' WHERE owner_id=$1 AND contact_id=$2`, owner, contact)
	return err
}

func (s *Store) SetBlocked(ctx context.Context, owner, contact uuid.UUID, blocked bool) error {
	state := "accepted"
	if blocked {
		state = "blocked"
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO contacts (owner_id, contact_id, state) VALUES ($1,$2,$3)
		ON CONFLICT (owner_id, contact_id) DO UPDATE SET state=EXCLUDED.state`, owner, contact, state)
	return err
}

func (s *Store) IsBlocked(ctx context.Context, owner, contact uuid.UUID) (bool, error) {
	var blocked bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM contacts WHERE owner_id=$1 AND contact_id=$2 AND state='blocked')`, owner, contact).Scan(&blocked)
	return blocked, err
}

type Conversation struct {
	ID       uuid.UUID
	PeerID   uuid.UUID
	Peer     string
	Username string
}

func pairKey(a, b uuid.UUID) string {
	as, bs := a.String(), b.String()
	if bs < as {
		return bs + ":" + as
	}
	return as + ":" + bs
}

func directConversation(ctx context.Context, tx pgx.Tx, a, b uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `INSERT INTO conversations (kind, created_by, direct_key) VALUES ('direct',$1,$2)
		ON CONFLICT (direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING id`, a, pairKey(a, b)).Scan(&id)
	if err != nil {
		return id, err
	}
	if a == b {
		_, err = tx.Exec(ctx, `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, id, a)
		return id, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING`, id, a, b)
	return id, err
}

func (s *Store) DirectConversation(ctx context.Context, a, b uuid.UUID) (Conversation, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Conversation{}, err
	}
	defer tx.Rollback(ctx)
	id, err := directConversation(ctx, tx, a, b)
	if err != nil {
		return Conversation{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Conversation{}, err
	}
	name, username := "", ""
	_ = s.Pool.QueryRow(ctx, `SELECT display_name, username FROM users WHERE id=$1`, b).Scan(&name, &username)
	return Conversation{ID: id, PeerID: b, Peer: name, Username: username}, nil
}

func (s *Store) Conversations(ctx context.Context, user uuid.UUID) ([]Conversation, error) {
	rows, err := s.Pool.Query(ctx, `SELECT c.id,
		COALESCE(other_user.id, self.id),
		COALESCE(other_user.display_name, self.display_name),
		COALESCE(other_user.username, self.username)
		FROM conversations c
		JOIN conversation_members me ON me.conversation_id=c.id AND me.user_id=$1
		JOIN users self ON self.id=$1
		LEFT JOIN conversation_members other_m ON other_m.conversation_id=c.id AND other_m.user_id<>$1
		LEFT JOIN users other_user ON other_user.id=other_m.user_id
		WHERE other_user.id IS NOT NULL OR NOT EXISTS (
			SELECT 1 FROM conversation_members x WHERE x.conversation_id=c.id AND x.user_id<>$1
		)`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Conversation
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.PeerID, &c.Peer, &c.Username); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) PutMessage(ctx context.Context, conv, sender, recipient, message uuid.UUID, envelope []byte, expires time.Time) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO mailbox_messages (conversation_id, sender_user_id, recipient_user_id, message_id, envelope, size_bytes, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (recipient_user_id, message_id) DO NOTHING`, conv, sender, recipient, message, envelope, len(envelope), expires)
	return err
}

type MailMessage struct {
	ID       uuid.UUID
	Envelope []byte
}

func (s *Store) Inbox(ctx context.Context, user uuid.UUID) ([]MailMessage, error) {
	rows, err := s.Pool.Query(ctx, `SELECT message_id, envelope FROM mailbox_messages WHERE recipient_user_id=$1 AND delivered_at IS NULL AND expires_at > now() ORDER BY created_at LIMIT 100`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MailMessage
	for rows.Next() {
		var m MailMessage
		if err := rows.Scan(&m.ID, &m.Envelope); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) AckMessage(ctx context.Context, user, message uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM mailbox_messages WHERE recipient_user_id=$1 AND message_id=$2`, user, message)
	return err
}

type MailFile struct {
	ID           uuid.UUID
	Conversation uuid.UUID
	Envelope     []byte
	Size         int64
	Path         string
}

func (s *Store) InboxFiles(ctx context.Context, user uuid.UUID) ([]MailFile, error) {
	rows, err := s.Pool.Query(ctx, `SELECT file_id, conversation_id, envelope, size_bytes FROM mailbox_files WHERE recipient_user_id=$1 AND state='ready' AND expires_at > now() ORDER BY created_at LIMIT 50`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MailFile
	for rows.Next() {
		var f MailFile
		if err := rows.Scan(&f.ID, &f.Conversation, &f.Envelope, &f.Size); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *Store) OpenFile(ctx context.Context, user, fileID uuid.UUID) (MailFile, error) {
	var f MailFile
	err := s.Pool.QueryRow(ctx, `SELECT file_id, conversation_id, envelope, size_bytes, storage_path FROM mailbox_files
		WHERE file_id=$2 AND state='ready' AND expires_at > now() AND (recipient_user_id=$1 OR sender_user_id=$1)`, user, fileID).Scan(&f.ID, &f.Conversation, &f.Envelope, &f.Size, &f.Path)
	return f, err
}

func (s *Store) AckFile(ctx context.Context, user, fileID uuid.UUID) (string, error) {
	var path string
	err := s.Pool.QueryRow(ctx, `DELETE FROM mailbox_files WHERE recipient_user_id=$1 AND file_id=$2 RETURNING storage_path`, user, fileID).Scan(&path)
	return path, err
}

func (s *Store) UserUsage(ctx context.Context, user uuid.UUID) (int64, error) {
	var n int64
	err := s.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(size_bytes),0) FROM mailbox_files WHERE recipient_user_id=$1 AND state IN ('uploading','ready')`, user).Scan(&n)
	return n, err
}

func (s *Store) GlobalUsage(ctx context.Context) (int64, error) {
	var n int64
	err := s.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(size_bytes),0) FROM mailbox_files WHERE state IN ('uploading','ready')`).Scan(&n)
	return n, err
}

func (s *Store) PutFile(ctx context.Context, conv, sender, recipient, fileID uuid.UUID, envelope []byte, size int64, sha []byte, path string, expires time.Time) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO mailbox_files (conversation_id, sender_user_id, recipient_user_id, file_id, envelope, size_bytes, sha256, storage_path, state, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ready',$9) ON CONFLICT (recipient_user_id, file_id) DO NOTHING`, conv, sender, recipient, fileID, envelope, size, sha, path, expires)
	return err
}

type DroppedMail struct {
	Sender   uuid.UUID
	Messages []uuid.UUID
	Files    []uuid.UUID
	Paths    []string
}

func (s *Store) DropMailbox(ctx context.Context, minAge time.Duration) ([]DroppedMail, error) {
	cutoff := time.Now().Add(-minAge)
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	bySender := map[uuid.UUID]*DroppedMail{}
	take := func(id uuid.UUID) *DroppedMail {
		row := bySender[id]
		if row == nil {
			row = &DroppedMail{Sender: id}
			bySender[id] = row
		}
		return row
	}
	messages, err := tx.Query(ctx, `SELECT sender_user_id, message_id FROM mailbox_messages WHERE created_at < $1 OR expires_at < now()`, cutoff)
	if err != nil {
		return nil, err
	}
	for messages.Next() {
		var sender, id uuid.UUID
		if err = messages.Scan(&sender, &id); err != nil {
			messages.Close()
			return nil, err
		}
		row := take(sender)
		row.Messages = append(row.Messages, id)
	}
	messages.Close()
	if err = messages.Err(); err != nil {
		return nil, err
	}
	files, err := tx.Query(ctx, `SELECT sender_user_id, file_id, storage_path FROM mailbox_files WHERE created_at < $1 OR expires_at < now() OR state IN ('delivered','expired')`, cutoff)
	if err != nil {
		return nil, err
	}
	for files.Next() {
		var sender, id uuid.UUID
		var path string
		if err = files.Scan(&sender, &id, &path); err != nil {
			files.Close()
			return nil, err
		}
		row := take(sender)
		row.Files = append(row.Files, id)
		if path != "" {
			row.Paths = append(row.Paths, path)
		}
	}
	files.Close()
	if err = files.Err(); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM mailbox_messages WHERE created_at < $1 OR expires_at < now()`, cutoff); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM mailbox_files WHERE created_at < $1 OR expires_at < now() OR state IN ('delivered','expired')`, cutoff); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	out := make([]DroppedMail, 0, len(bySender))
	for _, row := range bySender {
		out = append(out, *row)
	}
	return out, nil
}

func (s *Store) Cleanup(ctx context.Context) ([]DroppedMail, error) {
	dropped, err := s.DropMailbox(ctx, 24*time.Hour)
	if err != nil {
		return nil, err
	}
	if _, err = s.Pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at < now() OR revoked_at IS NOT NULL`); err != nil {
		return dropped, err
	}
	_, err = s.Pool.Exec(ctx, `DELETE FROM security_events WHERE created_at < now() - interval '90 days'`)
	return dropped, err
}

func IsNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
