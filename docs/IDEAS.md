# Ideas (best → least)

Ranked by impact for this product versus effort and risk. Small fixes are not listed; they went into the code. Shipped work is omitted.

1. **Contact requests instead of auto-accept** — Adding a username currently creates an accepted contact immediately. A request/accept step would stop strangers who guess a username from seeing presence and sending files. Needs a pending state in the API, a small inbox UI, and notification wording.

2. **Encrypted backup export and import** — Export the whole vault (records plus OPFS ciphertext plus wrapped DEK) as one file the user can store anywhere, and import it on a new browser with the vault password. Complements device transfer for users who own one device.

3. **Multi-device fan-out for messages you send** — Messages sent from one of your devices reach the peer but only reach your other devices through the periodic manifest sync. Sending a copy of every outgoing message envelope to your own trusted devices when they are online would make devices consistent in real time.

4. **Search and unread counters** — Local history is field-encrypted, so search means decrypting rows on demand. A sealed per-account inverted index (word → message ids), updated when messages are stored, would keep search fast without exposing text in IndexedDB. Unread counters need a per-conversation "last read at" stored locally and synchronized between the user's devices.

5. **Edit, delete-for-everyone, reply, reactions** — All of these need a new `kind` in the plaintext message schema with a reference to the target message id, sync of the resulting state across the sender's devices, and idempotent application on receivers. Delete-for-everyone is best-effort by design (receivers may have already exported the file). Reactions in groups need per-member aggregation.

6. **Resumable transfers with chunk acknowledgements** — Today a transfer restarts from zero after any interruption. Since files are already split into fixed 64 KB secretstream chunks with known lengths, the receiver could persist the partial ciphertext in OPFS together with the count of chunks written, and on reconnect send `chat.file.request { file_id, from_chunk }`. The sender would seek into its stored ciphertext and continue. Hard parts: secretstream is a running state, so the receiver can only resume decrypting from the start; the fix is to keep the partial ciphertext and decrypt it all once the tail arrives, or to switch large files to per-chunk XChaCha20-Poly1305 with an explicit chunk index in the AD so any chunk can be verified independently. The second option also unlocks parallel and out-of-order delivery.

7. **Forward secrecy and sender keys** — v1 encrypts to long-lived identity keys, so a leaked identity key exposes history captured on the wire. Options: Double Ratchet for direct chats plus Sender Keys for groups (Signal's model), or a simpler per-conversation ephemeral key rotated every N messages. This touches the protocol, sync, and multi-device; it is the biggest crypto change on the list.

8. **End-to-end Playwright tests with two browsers** — Sign in two users, exchange text and a large file over a real data channel, reload the sender mid-share, and assert the availability statuses. This is the test that would have caught most of the file-transfer bugs so far. Needs a disposable Postgres and the API in CI.

9. **Voice messages and calls** — The WebRTC stack is already there; voice messages are Opus blobs treated like files with an inline player. Calls need a call state machine (ringing, busy, missed), TURN cost planning, and a permission story on iOS.

10. **Accessibility pass** — Keyboard navigation through the conversation list and message menu, reduced-motion respect in transfer progress, and focus management when dialogs close.

11. **Multiple simultaneous transfers** — The single download lock keeps the UI simple but blocks a second download while a first one is running. Peer uploads in groups can already run a few at once; downloads and a transfer list UI are still one-at-a-time. Backpressure per data channel is in place.

12. **Send-side "optimise for sending" for photos and videos** — Offer an optional downscale/recompress (canvas for images, WebCodecs for video where available) before sending, showing before/after sizes. Big win for phones on mobile data; hard because WebCodecs support is uneven and the UI needs to stay honest about quality loss.

13. **Web Share Target and drag-and-drop of folders** — Register the PWA as a share target so "Share to chat.ma.cyou" from the OS drops a file into the current draft. Folder drops could be zipped client-side with a streaming zip writer straight into OPFS.

14. **Rotating the DEK after revoking a device** — `THREAT_MODEL.md` notes the DEK is not rotated in v1. Rotation means re-wrapping every record on every remaining device and re-running device sync with the new DEK. Doable, but must be atomic per device to avoid a half-rotated vault.

15. **SQLite-wasm on OPFS instead of Dexie** — IndexedDB on Safari is slow and eviction-happy. SQLite compiled to wasm with the OPFS VFS gives predictable performance, real queries (search, counters), and a single file per account that could also be exported as an encrypted backup. Large migration; do it once the schema settles.

16. **Use the capabilities endpoint** — The client hard-codes 25 MB and other limits from `@ma/protocol`. Fetching `/v1/capabilities` at start-up would let the server change limits without a deploy of the front end.

17. **Content-addressed deduplication** — The same file sent to several chats is stored several times. Keying the OPFS store by SHA-256 of the plaintext with reference counting would remove duplicates, at the cost of a full read before sending.
