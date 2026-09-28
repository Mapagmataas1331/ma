# Threat model

This system is not anonymous and does not provide forward secrecy in v1.

## Server compromise

An attacker gets account metadata, Argon2id password hashes, hashed session tokens, device public keys, the contact graph, mailbox ciphertext and sizes, push endpoints, and TOTP secrets only if they also have `SERVER_KEK`. They can impersonate signaling. They cannot read message bodies or files, because those are encrypted to identity keys that never leave the browser.

## Database compromise

Same as the server, except `SERVER_KEK` stays on disk outside the dump, so TOTP secrets remain ciphertext.

## Temporary file storage

Offline files are encrypted before upload. The per-file key is inside the client envelope, not on the server. Downloads are served as opaque `application/octet-stream` attachments so a browser never renders mailbox bytes in the API origin.

## Files kept on a device

Large files are kept as secretstream ciphertext in OPFS so the sender can share them again later. The file key, header, and chunk lengths are sealed under the vault DEK in IndexedDB, so a copy of the OPFS directory alone is useless. Availability probes (`chat.file.probe`) reveal to a peer whether you still hold a file they were sent; they are answered only for related users, and only for files that peer already knows about.

## Clearing a browser

"Clear all local data" deletes every account database, the legacy `ma-chat` database, OPFS, caches, storage, and service workers for the origin. It does not touch the server or other devices. Chats that exist only on that browser are gone.

## Browser XSS while unlocked

A script in this origin can read the in-memory DEK and local history. CSP, no third-party scripts, and auto-lock reduce the window. Encryption at rest does not help after unlock.

## Shared browser profile

Vaults, preferences, outboxes, and device secret keys are partitioned by user id. Logging out locks the vault, zeroes key material, closes sockets, and closes that account's database. A legacy vault whose identity key does not match the signed-in account is not claimed or deleted.

## Stolen device

Locked vault: the DEK is wrapped with Argon2id. Strength depends on the vault password. Unlocked and unattended: auto-lock is the control.

## Forgotten vault password

Local history is unrecoverable unless a recovery key or another trusted device still has the DEK.

## Lost device

Revoke it from another device. Local data on the lost device stays encrypted. The DEK is not rotated in v1.

## Malicious peer

They learn your IP unless relay-only is on. They can send files, which are never opened automatically. Blocking stops the server from relaying.

## WebRTC, TURN, signaling, push

Peers learn IPs and timing on a direct connection. STUN and TURN see IPs; TURN also sees volume. Signaling sees who is online and who is called, not content. Push payloads are `{ t: "mailbox", n: count }` with no message text.
