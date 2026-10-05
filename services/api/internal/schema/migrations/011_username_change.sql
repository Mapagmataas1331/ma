-- +goose Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS username_changed_at;
