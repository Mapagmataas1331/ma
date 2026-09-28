package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrNotFound    = errors.New("not_found")
	ErrForbidden   = errors.New("forbidden")
	ErrLastTrusted = errors.New("last_trusted_device")
	ErrRevoked     = errors.New("device_revoked")
)

type DeliveryAuth struct {
	Found             bool
	Kind              string
	SenderMember      bool
	RecipientMember   bool
	DirectPeerMatches bool
	Blocked           bool
}

func (s *Store) AuthorizeDelivery(ctx context.Context, conversation, sender, recipient uuid.UUID) (DeliveryAuth, error) {
	var auth DeliveryAuth
	err := s.Pool.QueryRow(ctx, `SELECT c.kind,
		EXISTS(SELECT 1 FROM conversation_members m WHERE m.conversation_id=c.id AND m.user_id=$2 AND m.left_at IS NULL),
		EXISTS(SELECT 1 FROM conversation_members m WHERE m.conversation_id=c.id AND m.user_id=$3 AND m.left_at IS NULL),
		CASE WHEN c.kind='direct' THEN
			($2=$3 AND EXISTS(SELECT 1 FROM conversation_members m WHERE m.conversation_id=c.id AND m.user_id=$2 AND m.left_at IS NULL))
			OR EXISTS(SELECT 1 FROM conversation_members m WHERE m.conversation_id=c.id AND m.user_id=$3 AND m.user_id<>$2 AND m.left_at IS NULL)
		ELSE true END,
		EXISTS(SELECT 1 FROM contacts WHERE state='blocked' AND ((owner_id=$3 AND contact_id=$2) OR (owner_id=$2 AND contact_id=$3)))
		FROM conversations c WHERE c.id=$1`, conversation, sender, recipient).Scan(&auth.Kind, &auth.SenderMember, &auth.RecipientMember, &auth.DirectPeerMatches, &auth.Blocked)
	if errors.Is(err, pgx.ErrNoRows) {
		return DeliveryAuth{}, nil
	}
	if err != nil {
		return DeliveryAuth{}, err
	}
	auth.Found = true
	return auth, nil
}

func (s *Store) CanReadIdentity(ctx context.Context, viewer, target uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx, `SELECT $1=$2
		OR EXISTS(SELECT 1 FROM contacts WHERE owner_id=$1 AND contact_id=$2 AND state='accepted')
		OR EXISTS(
			SELECT 1 FROM conversation_members a
			JOIN conversation_members b ON b.conversation_id=a.conversation_id
			WHERE a.user_id=$1 AND b.user_id=$2 AND a.left_at IS NULL AND b.left_at IS NULL
		)`, viewer, target).Scan(&ok)
	return ok, err
}

func (s *Store) SignalRelated(ctx context.Context, a, b uuid.UUID) (related, blocked bool, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT
		EXISTS(SELECT 1 FROM contacts WHERE state='accepted' AND ((owner_id=$1 AND contact_id=$2) OR (owner_id=$2 AND contact_id=$1)))
		OR EXISTS(
			SELECT 1 FROM conversation_members ma
			JOIN conversation_members mb ON mb.conversation_id=ma.conversation_id
			WHERE ma.user_id=$1 AND mb.user_id=$2 AND ma.left_at IS NULL AND mb.left_at IS NULL
		),
		EXISTS(SELECT 1 FROM contacts WHERE state='blocked' AND ((owner_id=$1 AND contact_id=$2) OR (owner_id=$2 AND contact_id=$1)))`, a, b).Scan(&related, &blocked)
	return related, blocked, err
}

func (s *Store) PresencePeerIDs(ctx context.Context, user uuid.UUID) ([]uuid.UUID, error) {
	rows, err := s.Pool.Query(ctx, `SELECT DISTINCT peer FROM (
		SELECT contact_id AS peer FROM contacts WHERE owner_id=$1 AND state='accepted'
		UNION
		SELECT other.user_id FROM conversation_members me
		JOIN conversation_members other ON other.conversation_id=me.conversation_id AND other.user_id<>$1 AND other.left_at IS NULL
		WHERE me.user_id=$1 AND me.left_at IS NULL
	) peers`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *Store) PublicDevices(ctx context.Context, userID uuid.UUID) ([]Device, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, user_id, name, platform, trust_state, last_seen_at, device_pk_x25519 FROM devices
		WHERE user_id=$1 AND revoked_at IS NULL AND trust_state='trusted' ORDER BY last_seen_at DESC NULLS LAST`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Platform, &d.Trust, &d.LastSeen, &d.X); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) DeviceOwned(ctx context.Context, userID, deviceID uuid.UUID) (Device, error) {
	var d Device
	err := s.Pool.QueryRow(ctx, `SELECT id, user_id, name, platform, trust_state, last_seen_at FROM devices
		WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, deviceID, userID).Scan(&d.ID, &d.UserID, &d.Name, &d.Platform, &d.Trust, &d.LastSeen)
	if errors.Is(err, pgx.ErrNoRows) {
		return Device{}, ErrNotFound
	}
	return d, err
}

func (s *Store) RevokeOwnedDevice(ctx context.Context, userID, deviceID uuid.UUID, confirmLast bool) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var trust string
	err = tx.QueryRow(ctx, `SELECT trust_state FROM devices WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, deviceID, userID).Scan(&trust)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if trust == "trusted" {
		var n int
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM devices WHERE user_id=$1 AND trust_state='trusted' AND revoked_at IS NULL`, userID).Scan(&n); err != nil {
			return err
		}
		if n <= 1 && !confirmLast {
			return ErrLastTrusted
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE devices SET trust_state='revoked', revoked_at=now() WHERE id=$1 AND user_id=$2`, deviceID, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND device_id=$2 AND revoked_at IS NULL`, userID, deviceID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) TrustOwnedDevice(ctx context.Context, userID, targetID, byID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE devices SET trust_state='trusted', trusted_by_device_id=$3
		WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND trust_state='pending'
		AND EXISTS(SELECT 1 FROM devices actor WHERE actor.id=$3 AND actor.user_id=$2 AND actor.trust_state='trusted' AND actor.revoked_at IS NULL)`, targetID, userID, byID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RevokeDevice(ctx context.Context, id uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE devices SET trust_state='revoked', revoked_at=now() WHERE id=$1 AND revoked_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=now() WHERE device_id=$1 AND revoked_at IS NULL`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
