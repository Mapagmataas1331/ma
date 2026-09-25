# Protocol

Signaling frames are JSON: `{ v: 1, t, id, to?, from?, p }`.

Types: `welcome`, `rtc.offer`, `rtc.answer`, `rtc.ice`, `rtc.bye`, `presence.update`, `mailbox.new`, `device.trusted`, `device.revoked`, `pair.confirm`, `error`.

The server relays `to` frames between devices of users and stores nothing. If the target has no socket, the sender gets `error` with `code: offline` and should use the mailbox.

Text envelopes: `{ v: 1, alg: "x25519-xchacha20poly1305", sender_identity_pk, nonce, ciphertext }` using libsodium `crypto_box_easy`. The server stores the envelope bytes only.

Device linking: the new device shows an 8-character code and QR. The trusted device confirms with HMAC-SHA512-256 over `pkA|pkB|pairingId` keyed by a hash of the code. The code is not sent to the server. The DEK and history move over the WebRTC data channel.
