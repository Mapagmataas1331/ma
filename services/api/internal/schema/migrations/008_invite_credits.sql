-- +goose Up
ALTER TABLE users ALTER COLUMN invite_credits SET DEFAULT 3;
UPDATE users SET invite_credits = 3 WHERE invite_credits < 3;

-- +goose Down
ALTER TABLE users ALTER COLUMN invite_credits SET DEFAULT 1;
