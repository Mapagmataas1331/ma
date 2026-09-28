# Protocol

Signaling frames are JSON: `{ v: 1, t, id, to?, from?, p }`.

Types: `welcome`, `rtc.offer`, `rtc.answer`, `rtc.ice`, `rtc.bye`, `presence.update`, `mailbox.new`, `device.trusted`, `device.revoked`, `pair.confirm`, `error`.

The server relays `to` frames between devices of users and stores nothing. If the target has no socket, the sender gets `error` with `code: offline` and should use the mailbox.

Text envelopes: `{ v: 1, alg: "x25519-xchacha20poly1305", sender_identity_pk, nonce, ciphertext }` using libsodium `crypto_box_easy`. The server stores the envelope bytes only.

Device linking: a trusted device starts a pairing session and receives a short-lived code. The pending device submits that code once. The server keeps the session in memory, allows one claim, and never stores the DEK or history. Both devices compare a fingerprint. After the trusted device confirms, identity keys and history move over a WebRTC data channel. If the new device already has messages, both sides keep their own and exchange only the missing ones. Later, trusted devices of the same account repeat that exchange when they are online together. The target device is marked trusted only after that transfer is completed. Signaling must not carry `chat.file.chunk` or any payload field named `data`.
