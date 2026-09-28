-- +goose Up
-- One ciphertext on disk, linked to every recipient. Quota counts the blob once, against the sender.
CREATE TABLE mailbox_blobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES users(id),
  conversation_id uuid NOT NULL,
  file_id uuid NOT NULL UNIQUE,
  envelope bytea NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 bytea,
  storage_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mailbox_blobs_sender ON mailbox_blobs (sender_user_id);

CREATE TABLE mailbox_file_recipients (
  blob_id uuid NOT NULL REFERENCES mailbox_blobs(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  delivered_at timestamptz,
  PRIMARY KEY (blob_id, recipient_user_id)
);

INSERT INTO mailbox_blobs (sender_user_id, conversation_id, file_id, envelope, size_bytes, sha256, storage_path, expires_at, created_at)
SELECT DISTINCT ON (file_id) sender_user_id, conversation_id, file_id, envelope, size_bytes, sha256, storage_path, expires_at, created_at
FROM mailbox_files
WHERE state IN ('uploading', 'ready')
ORDER BY file_id, created_at;

INSERT INTO mailbox_file_recipients (blob_id, recipient_user_id, delivered_at)
SELECT b.id, f.recipient_user_id, f.delivered_at
FROM mailbox_files f
JOIN mailbox_blobs b ON b.file_id = f.file_id
ON CONFLICT DO NOTHING;

DROP TABLE mailbox_files;

-- +goose Down
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
  state text NOT NULL DEFAULT 'ready',
  expires_at timestamptz NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, file_id)
);

INSERT INTO mailbox_files (conversation_id, sender_user_id, recipient_user_id, file_id, envelope, size_bytes, sha256, storage_path, state, expires_at, delivered_at, created_at)
SELECT b.conversation_id, b.sender_user_id, r.recipient_user_id, b.file_id, b.envelope, b.size_bytes, b.sha256, b.storage_path, 'ready', b.expires_at, r.delivered_at, b.created_at
FROM mailbox_blobs b
JOIN mailbox_file_recipients r ON r.blob_id = b.id;

DROP TABLE mailbox_file_recipients;
DROP TABLE mailbox_blobs;
