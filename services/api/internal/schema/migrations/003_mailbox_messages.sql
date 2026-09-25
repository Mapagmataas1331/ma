-- +goose Up
CREATE TABLE mailbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_user_id uuid NOT NULL REFERENCES users(id),
  sender_device_id uuid,
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  recipient_device_id uuid,
  message_id uuid NOT NULL,
  envelope bytea NOT NULL,
  size_bytes int NOT NULL,
  expires_at timestamptz NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, message_id)
);

-- +goose Down
DROP TABLE IF EXISTS mailbox_messages;
