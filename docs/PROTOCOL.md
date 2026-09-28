# Protocol

Signaling frames are JSON: `{ v: 1, t, id, to?, from?, p }`.

Types: `welcome`, `rtc.offer`, `rtc.answer`, `rtc.ice`, `rtc.bye`, `presence.snapshot`, `presence.update`, `mailbox.new`, `contacts.updated`, `conversations.updated`, `chat.typing`, `chat.delivered`, `chat.read`, `chat.expired`, `chat.file.request`, `chat.file.probe`, `chat.file.have`, `chat.file.missing`, `chat.file.cancel`, `chat.file.busy`, `device.trusted`, `device.revoked`, `pair.confirm`, `error`.

The server relays `to` frames between devices of users and stores nothing. A frame may be relayed only between devices of the same account, accepted contacts, or members of a shared conversation; blocked pairs are refused. If the target has no socket, the sender gets `error` with `code: offline` and should use the mailbox.

Large-file availability: a receiver that sees a peer-only file and does not hold it locally sends `chat.file.probe { file_id }` to the sender (at most once per 30 s per file, and again when the sender's presence changes). The sender answers `chat.file.have` if the plaintext or its stored ciphertext is still on that device, otherwise `chat.file.missing`; the receiver marks such files as gone and stops offering a download. `chat.file.request` starts the actual transfer; the sender replies `chat.file.busy` if another transfer is running or `chat.file.missing` if the file is gone.

Data-channel file transfer: the sender opens with a JSON `file.start { file_id, name, mime, size, key, header, lengths }` (secretstream key and header plus the ciphertext chunk lengths), then sends the ciphertext chunks as binary messages in order, then `file.end { file_id }` or `file.abort { file_id }`. Chunks are 64 KB of plaintext plus the 17-byte secretstream tag. The receiver decrypts as it goes and writes the ciphertext straight to its own store, so a received file is kept without re-encryption.

Text envelopes: `{ v: 1, alg: "x25519-xchacha20poly1305", sender_identity_pk, nonce, ciphertext }` using libsodium `crypto_box_easy`. The server stores the envelope bytes only.

Device linking: a trusted device starts a pairing session and receives a short-lived code. The pending device submits that code once. The server keeps the session in memory, allows one claim, and never stores the DEK or history. Both devices compare a fingerprint. After the trusted device confirms, identity keys and history move over a WebRTC data channel. If the new device already has messages, both sides keep their own and exchange only the missing ones. Later, trusted devices of the same account repeat that exchange when they are online together. The target device is marked trusted only after that transfer is completed. Signaling must not carry `chat.file.chunk` or any payload field named `data`.
