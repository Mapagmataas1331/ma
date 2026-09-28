-- +goose Up
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS membership_version int NOT NULL DEFAULT 1;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS left_at timestamptz;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('direct', 'group'));
ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_role_check;
ALTER TABLE conversation_members ADD CONSTRAINT conversation_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

-- +goose Down
ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_role_check;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversation_members DROP COLUMN IF EXISTS left_at;
ALTER TABLE conversations DROP COLUMN IF EXISTS membership_version;
ALTER TABLE conversations DROP COLUMN IF EXISTS title;
