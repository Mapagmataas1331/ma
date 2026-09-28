# Changelog

## Unreleased

- Group chats work end to end: messages, typing, receipts, and files fan out to every member; sender names in bubbles; a group info sheet for rename, add/remove members, transfer ownership, leave, and delete. The API returns `group_full`, `not_contact`, and `owner_must_transfer` codes and notifies every member when a group changes.
- Storage is one per-account budget (default 5 GB) for chats, cached files, and the outbox queue instead of per-file caps. File ciphertext lives in OPFS with keys sealed in the vault; the oldest files are evicted first.
- Large files are encrypted once at send time and kept, so the sender can keep sharing after a reload or reconnect. Transfers stream 64 KB chunks with data-channel back-pressure, and receivers write ciphertext directly to disk.
- File bubbles show availability ("On this device", "Ready to download", "Available from sender", "Sender is offline", "Not available anymore", "Shared from this device") driven by `chat.file.probe`/`have`/`missing`.
- Chat settings gained "Clear all local data", available before the vault is unlocked, that wipes every database (including the legacy `ma-chat`), OPFS, caches, storage, and service workers.
- Vault password flow explains what the vault is and why it must differ from the account password; creating a vault asks for the password twice.
- Recovery key, TOTP setup, and device list moved into real dialogs; sign-in sends a friendly device name; errors map to translated messages; day dividers and stick-to-bottom scrolling in threads; delete-for-me on messages.
- Mailbox downloads are served as `application/octet-stream` with `nosniff`, a safe `Content-Disposition`, and `Content-Length`; the per-inbox quota check uses the recipient.
- English and Russian copy reviewed across the site; Russian consistently says "сейф" for the vault.

## 0.1.0

- Monorepo with home, resume, projects, and chat apps.
- Shared Drift design system, English-first i18n, and résumé content.
- Go API for invite registration, sessions, devices, contacts, mailbox, signaling, TOTP, and push subscription storage.
- Per-account chat vaults, trusted-device checks, ciphertext-only mailbox files, and group membership for up to 20 people.
- Device-to-device transfer of the vault key over WebRTC, with the pairing code kept only in server memory.
