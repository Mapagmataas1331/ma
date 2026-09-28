# Architecture

Four static Vite apps share `@ma/ui`, `@ma/i18n`, and `@ma/content`. Chat also uses `@ma/crypto`, `@ma/protocol`, and `@ma/api-client`.

`services/api` is one Go process: REST, WebSocket signaling, presence in memory, temporary mailbox on local disk, cleanup every 10 minutes. PostgreSQL holds accounts, devices, contacts, conversations, and mailbox metadata. There is no Redis.

Online text and files use WebRTC data channels. Offline text and files up to 25 MB are client-encrypted and stored until ack or expiry. Larger files stay in the sender OPFS until the peer is online.

Local history is field-encrypted in IndexedDB under a random DEK wrapped by an Argon2id key from the vault password. The server never sees that key. Each account uses its own database, `ma-chat-v2:<user-id>`, plus an OPFS directory for ciphertext. A legacy unowned `ma-chat` database is copied only when its identity public key matches the signed-in account.

Direct chats encrypt one envelope to the peer identity. Group chats fan out one envelope per member, with a maximum of 20 members, and do not use a shared group key. Device transfer moves the DEK and identity keys over a WebRTC data channel after a trusted device confirms a short-lived pairing code. Pending devices can open that pairing socket, not conversations, mailbox, or TURN.

See `THREAT_MODEL.md`, `PROTOCOL.md`, and `DEPLOY.md`.
