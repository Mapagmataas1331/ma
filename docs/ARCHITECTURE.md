# Architecture

Four static Vite apps share `@ma/ui`, `@ma/i18n`, and `@ma/content`. Chat also uses `@ma/crypto`, `@ma/protocol`, and `@ma/api-client`.

`services/api` is one Go process: REST, WebSocket signaling, presence in memory, temporary mailbox on local disk, cleanup every 10 minutes. PostgreSQL holds accounts, devices, contacts, conversations, and mailbox metadata. There is no Redis.

Online text and files use WebRTC data channels. Offline text and files up to 25 MB are client-encrypted and stored until ack or expiry. Larger files stay in the sender OPFS until the peer is online.

Local history is field-encrypted in IndexedDB under a random DEK wrapped by an Argon2id key from the vault password. The server never sees that key.

See `THREAT_MODEL.md`, `PROTOCOL.md`, and `DEPLOY.md`.
