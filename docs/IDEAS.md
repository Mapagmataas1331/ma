# Ideas and larger improvements

Things found while going through the project that are too big or too risky to do in passing. Each entry says what it would change, why it matters, and what makes it hard. Small fixes are not listed here; they went straight into the code.

## File transfer

### Resumable transfers with chunk acknowledgements
Today a transfer restarts from zero after any interruption. Since files are already split into fixed 64 KB secretstream chunks with known lengths, the receiver could persist the partial ciphertext in OPFS together with the count of chunks written, and on reconnect send `chat.file.request { file_id, from_chunk }`. The sender would seek into its stored ciphertext and continue. Hard parts: secretstream is a running state, so the receiver can only resume decrypting from the start; the fix is to keep the partial ciphertext and decrypt it all once the tail arrives, or to switch large files to per-chunk XChaCha20-Poly1305 with an explicit chunk index in the AD so any chunk can be verified independently. The second option also unlocks parallel and out-of-order delivery.

### Peer-to-peer distribution inside groups
A large file sent to a 20-person group is currently served by the sender to each member, one at a time. Once a member holds the ciphertext (which is identical for everyone, since the key is in the message), that member can serve it to others. `chat.file.have` already tells a receiver who has the file; add a "choose any online holder" step before `chat.file.request` and let the holder stream from OPFS. Needs a per-file transfer lock that allows several concurrent uploads and a fairness rule so one device is not saturated.

### Multiple simultaneous transfers
The single `transferLock` keeps the UI simple but blocks a second download while a first one is running. Backpressure per data channel is now in place, so several transfers could run at once with a small queue and per-transfer progress rows. The remaining work is UI (a transfer list) and bounding total memory for in-flight plaintext previews.

### Send-side "optimise for sending" for photos and videos
Offer an optional downscale/recompress (canvas for images, WebCodecs for video where available) before sending, showing before/after sizes. Big win for phones on mobile data; hard because WebCodecs support is uneven and the UI needs to stay honest about quality loss.

### Web Share Target and drag-and-drop of folders
Register the PWA as a share target so "Share to chat.ma.cyou" from the OS drops a file into the current draft. Folder drops could be zipped client-side with a streaming zip writer straight into OPFS.

## Messaging

### Edit, delete-for-everyone, reply, reactions
All of these need a new `kind` in the plaintext message schema with a reference to the target message id, sync of the resulting state across the sender's devices, and idempotent application on receivers. Delete-for-everyone is best-effort by design (receivers may have already exported the file). Reactions in groups need per-member aggregation.

### Search and unread counters
Local history is field-encrypted, so search means decrypting rows on demand. A sealed per-account inverted index (word → message ids), updated when messages are stored, would keep search fast without exposing text in IndexedDB. Unread counters need a per-conversation "last read at" stored locally and synchronized between the user's devices.

### Per-member receipts in groups
Receipts are currently binary for the whole message. Groups should show "seen by 3 of 7" and, on tap, who has seen it. Requires storing receipts per sender/recipient pair and a compact UI.

### Voice messages and calls
The WebRTC stack is already there; voice messages are Opus blobs treated like files with an inline player. Calls need a call state machine (ringing, busy, missed), TURN cost planning, and a permission story on iOS.

### Multi-device fan-out for messages you send
Messages sent from one of your devices reach the peer but only reach your other devices through the periodic manifest sync. Sending a copy of every outgoing message envelope to your own trusted devices when they are online would make devices consistent in real time.

## Security

### Forward secrecy and sender keys
v1 encrypts to long-lived identity keys, so a leaked identity key exposes history captured on the wire. Options: Double Ratchet for direct chats plus Sender Keys for groups (Signal's model), or a simpler per-conversation ephemeral key rotated every N messages. This touches the protocol, sync, and multi-device; it is the biggest change on the list.

### WebAuthn PRF for vault unlock
Let the vault password be replaced (or supplemented) by a platform authenticator with the PRF extension: the KEK is derived from the PRF output, so unlocking is a fingerprint or face instead of a typed password. Needs a fallback path for browsers without PRF and clear recovery-key messaging.

### Contact requests instead of auto-accept
Adding a username currently creates an accepted contact immediately. A request/accept step would stop strangers who guess a username from seeing presence and sending files. Needs a pending state in the API, a small inbox UI, and notification wording.

### Rotating the DEK after revoking a device
`THREAT_MODEL.md` notes the DEK is not rotated in v1. Rotation means re-wrapping every record on every remaining device and re-running device sync with the new DEK. Doable, but must be atomic per device to avoid a half-rotated vault.

## Storage

### SQLite-wasm on OPFS instead of Dexie
IndexedDB on Safari is slow and eviction-happy. SQLite compiled to wasm with the OPFS VFS gives predictable performance, real queries (search, counters), and a single file per account that could also be exported as an encrypted backup. Large migration; do it once the schema settles.

### Encrypted backup export and import
Export the whole vault (records plus OPFS ciphertext plus wrapped DEK) as one file the user can store anywhere, and import it on a new browser with the vault password. Complements device transfer for users who own one device.

### Content-addressed deduplication
The same file sent to several chats is stored several times. Keying the OPFS store by SHA-256 of the plaintext with reference counting would remove duplicates, at the cost of a full read before sending.

## Product and quality

### End-to-end Playwright tests with two browsers
Sign in two users, exchange text and a large file over a real data channel, reload the sender mid-share, and assert the availability statuses. This is the test that would have caught most of the file-transfer bugs so far. Needs a disposable Postgres and the API in CI.

### Use the capabilities endpoint
The client hard-codes 25 MB and other limits from `@ma/protocol`. Fetching `/v1/capabilities` at start-up would let the server change limits without a deploy of the front end.

### Notification improvements
Group notifications should say which group; muted conversations should not notify; a badge count on the PWA icon via the Badging API.

### Accessibility pass
Keyboard navigation through the conversation list and message menu, reduced-motion respect in transfer progress, and focus management when dialogs close.
