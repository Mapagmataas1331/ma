# ma.cyou

Personal site: writing, work, and a private messenger.

[![License: All rights reserved](https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey)](LICENSE)

SPDX-License-Identifier: LicenseRef-AllRightsReserved

The home page is [ma.cyou](https://ma.cyou). It introduces the other sites and links out to GitHub, Telegram, email, and YouTube.

## Sites

| Site | Address |
| --- | --- |
| Home | [ma.cyou](https://ma.cyou) |
| Résumé | [me.ma.cyou](https://me.ma.cyou) |
| Projects | [projects.ma.cyou](https://projects.ma.cyou) |
| Chat | [chat.ma.cyou](https://chat.ma.cyou) |

**[ma.cyou](https://ma.cyou)** is the front door. It points to the résumé, the project list, and the chat, and lists public contact links.

**[me.ma.cyou](https://me.ma.cyou)** is the résumé. It covers work on web systems for data: APIs, PostgreSQL and Redis, interfaces, and the Linux servers they run on, including about three years at the Budker Institute of Nuclear Physics in Novosibirsk. The same page is available in Russian. Entries that have a write-up on [projects.ma.cyou](https://projects.ma.cyou) link to that page.

**[projects.ma.cyou](https://projects.ma.cyou)** is a list of work and personal projects, with a page for each one. Examples include database workspaces, time-series charts, monitoring, PocketCam, and [chat.ma.cyou](https://chat.ma.cyou).

**[chat.ma.cyou](https://chat.ma.cyou)** is an invite-only messenger. Conversations are one to one or groups of up to 20 contacts. Message text and files are encrypted in the browser before they leave the device. A local vault (separate from the account password) holds identity keys and history on the device; the vault password never goes to the server.

When people are online, encrypted traffic is delivered live (peer-to-peer when a WebRTC link forms, otherwise a short-lived websocket relay). TURN at [turn.ma.cyou](https://turn.ma.cyou) helps peer links through NAT. Files between online people have no size limit. Any online group member who already has a copy can hand that file to another member; if several can, the closest connection is used. Someone who comes online while a send is still open can still join it.

When someone is offline, an encrypted copy can wait on [api.ma.cyou](https://api.ma.cyou) for up to 24 hours, then it is deleted. Each account has 5 GB of cloud space for those waiting files (messages are free); a group stores each file once and links it to every recipient who still needs it. After a recipient saves or ACKs, their link is removed; when nobody needs the blob, it is deleted. A file larger than 5 GB is sent only to people who are online. If a smaller file does not fit the remaining cloud space, the sender can free space or send it only to people who are online.

Settings include background notifications (optional), “relay only” (hide IP via TURN), and “no server” (skip the offline mailbox). Accounts are created with an invite, not an open sign-up form.

## Contact

- Email: [me@ma.cyou](mailto:me@ma.cyou)
- GitHub: [mapagmataas1331](https://github.com/mapagmataas1331/)
- Telegram: [@mapagmataas](https://t.me/mapagmataas)
- YouTube: [@mapagmataas](https://youtube.com/@mapagmataas/)

## License

Copyright (c) 2022-2026 Timofey (Mapagmataas). All rights reserved.
See [LICENSE](LICENSE).
