-- +goose Up
CREATE TABLE mailbox_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_user_id uuid NOT NULL REFERENCES users(id),
  sender_device_id uuid,
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  file_id uuid NOT NULL,
  envelope bytea NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 bytea,
  storage_path text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'uploading',
  expires_at timestamptz NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, file_id)
);

-- +goose Down
DROP TABLE IF EXISTS mailbox_files;
