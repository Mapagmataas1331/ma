# Ideas (most → least valuable)

Ordered by expected value for people who use the site (especially Chat) and for the owner who runs it, then by effort and risk. **Effort** is a rough 1–10 scale: **1** = hours / a small PR, **10** = multi-week protocol or platform work. Small fixes are not listed; they went into the code. Shipped work is omitted.

1. **Contact requests instead of auto-accept** — Effort: **4/10**. Value: stops strangers who guess a username from seeing presence and sending files; basic safety for an invite-gated network. Needs a pending state in the API, a small inbox UI, and notification wording.

2. **End-to-end Playwright tests with two browsers** — Effort: **6/10**. Value: would have caught most file-transfer and sync regressions; high leverage for a crypto/messaging product. Sign in two users, exchange text and a large file over a real data channel, reload mid-share, assert availability. Needs disposable Postgres and the API in CI.

3. **Encrypted backup export and import** — Effort: **5/10**. Value: one-file recovery of the vault for single-device users; reduces fear of wiping a browser. Export records + OPFS ciphertext + wrapped DEK; import with the vault password. Complements device transfer.

4. **Search and unread counters** — Effort: **7/10**. Value: everyday chat usability once history grows. Local history is field-encrypted, so search means decrypting on demand or a sealed inverted index; unread needs per-conversation last-read synced across the user's devices.

5. **Multi-device fan-out for messages you send** — Effort: **5/10**. Value: devices stay consistent in real time instead of waiting on periodic manifest sync. Send a copy of every outgoing envelope to your other trusted devices when they are online.

6. **Resumable transfers with chunk acknowledgements** — Effort: **8/10**. Value: large files survive flaky mobile networks. Persist partial ciphertext + chunk count; `chat.file.request { file_id, from_chunk }`. Hard parts: secretstream state vs per-chunk AEAD for out-of-order delivery.

7. **Edit, delete-for-everyone, reply, reactions** — Effort: **7/10**. Value: expected messenger affordances. New plaintext `kind`s, sync across sender devices, best-effort delete-for-everyone, group reaction aggregation.

8. **Use the capabilities endpoint** — Effort: **2/10**. Value: change size limits and feature flags without redeploying the front end. Client currently hard-codes limits from `@ma/protocol`; fetch `/v1/capabilities` at start-up.

9. **Accessibility pass** — Effort: **3/10**. Value: keyboard nav through conversation list and message menu, reduced-motion in transfer progress, focus restore when dialogs close. Complements skip-link / landmarks work.

10. **Skip link and landmark audit** — Effort: **2/10**. Value: screen-reader entry to main content across all four apps. Small, high accessibility leverage; pairs with #9.

11. **Dynamic document title and Open Graph per locale** — Effort: **2/10**. Value: RU tabs and shared links match the UI; project detail pages get real titles. Small helper in `@ma/i18n` plus a hook per app.

12. **Shared site-switcher blurbs** — Effort: **2/10**. Value: first-time visitors jumping from chat to résumé understand each subdomain. Reuse home blurbs via a shared copy module.

13. **Contrast tokens for text on sky** — Effort: **3/10**. Value: WCAG AA on pale skies without per-app CSS forks. Single `data-sky` token set for muted/link/accent.

14. **Chat composer polish and draft restore** — Effort: **4/10**. Value: less friction on mobile; drafts survive unlock. Autosize textarea, sticky attach/send, restore unfinished draft. No protocol change.

15. **Multiple simultaneous transfers** — Effort: **5/10**. Value: download while another download runs; clearer transfer list. Peer uploads already allow a few; downloads are still one-at-a-time.

16. **Send-side "optimise for sending" for photos and videos** — Effort: **6/10**. Value: big win on mobile data. Optional downscale/recompress with honest before/after sizes; WebCodecs support is uneven.

17. **Project screenshots and OG images** — Effort: **4/10**. Value: scannable projects grid and better link previews. Optional hero images in frontmatter + generated `og:image`.

18. **Web Share Target and drag-and-drop of folders** — Effort: **5/10**. Value: OS "Share to chat.ma.cyou" and folder drops into OPFS via streaming zip. Nice for power users; PWA registration required.

19. **Voice messages and calls** — Effort: **8/10**. Value: natural next messenger feature; WebRTC stack is already there. Voice notes are Opus blobs; calls need state machine, TURN cost, iOS permissions.

20. **Forward secrecy and sender keys** — Effort: **10/10**. Value: a leaked identity key should not expose captured history. Double Ratchet + Sender Keys (or simpler rotation). Touches protocol, sync, multi-device — largest crypto change.

21. **Rotating the DEK after revoking a device** — Effort: **8/10**. Value: closes a known `THREAT_MODEL.md` gap after revoke. Re-wrap every record on remaining devices; must be atomic per device.

22. **SQLite-wasm on OPFS instead of Dexie** — Effort: **9/10**. Value: predictable Safari performance, real queries for search/counters, single exportable file. Large migration once the schema settles.

23. **Content-addressed deduplication** — Effort: **6/10**. Value: same file in several chats stored once. SHA-256 keyed OPFS with refcounts; costs a full read before send.

## Security findings

Sorted by severity. Crypto, auth, WebAuthn, and protocol behaviour were not changed in the UI audit pass.

1. **Contact auto-accept (medium)** — Adding a username creates an accepted contact immediately. Tracked as idea #1 above.
2. **Long-lived identity keys / no forward secrecy (medium–high, by design in v1)** — Captured ciphertext remains decryptable if an identity key leaks later. Tracked as idea #20.
3. **DEK not rotated after device revoke (medium)** — Noted in `THREAT_MODEL.md`. Tracked as idea #21.
4. **Quiet identity publish failures (low)** — `publishIdentityIfEmpty(..., quiet)` swallows errors to avoid toast spam; worth diagnostics later, not a user-facing hole by itself.
5. **No password logging found in settings UI (informational)** — Account forms reviewed; none found.
