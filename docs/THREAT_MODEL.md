# Threat model

This system is not anonymous and does not provide forward secrecy in v1.

## Server compromise

An attacker gets account metadata, Argon2id password hashes, hashed session tokens, device public keys, the contact graph, mailbox ciphertext and sizes, push endpoints, and TOTP secrets only if they also have `SERVER_KEK`. They can impersonate signaling. They cannot read message bodies or files, because those are encrypted to identity keys that never leave the browser.

## Database compromise

Same as the server, except `SERVER_KEK` stays on disk outside the dump, so TOTP secrets remain ciphertext.

## Temporary file storage

Offline files are encrypted before upload. The per-file key is inside the client envelope, not on the server.

## Browser XSS while unlocked

A script in this origin can read the in-memory DEK and local history. CSP, no third-party scripts, and auto-lock reduce the window. Encryption at rest does not help after unlock.

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
