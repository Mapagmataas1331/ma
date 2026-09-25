-- +goose Up
ALTER TABLE users ADD COLUMN invite_credits int NOT NULL DEFAULT 1;

CREATE TABLE invite_redemptions (
  invitee_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invite_redemptions_inviter ON invite_redemptions (inviter_id);

-- +goose Down
DROP TABLE IF EXISTS invite_redemptions;
ALTER TABLE users DROP COLUMN IF EXISTS invite_credits;
