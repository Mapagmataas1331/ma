# ma.cyou

Personal site for Timofey (Mapagmataas): home, résumé, projects, and an invite-only end-to-end encrypted chat.

<!-- SPDX-License-Identifier: LicenseRef-AllRightsReserved -->

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey" alt="License: All rights reserved" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D22-339933" alt="Node >= 22" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/pnpm-10-f69220" alt="pnpm 10" /></a>
</p>

<p align="center">
  <img src="docs/screenshots/home-dark-light.jpg" alt="ma.cyou home — dark and light sky themes side by side" width="900" />
</p>

## Sites

| Site | URL | Dev |
| --- | --- | --- |
| Home | [ma.cyou](https://ma.cyou) | http://127.0.0.1:5173 |
| Résumé | [me.ma.cyou](https://me.ma.cyou) | http://127.0.0.1:5174 |
| Projects | [projects.ma.cyou](https://projects.ma.cyou) | http://127.0.0.1:5175 |
| Chat | [chat.ma.cyou](https://chat.ma.cyou) | http://127.0.0.1:5176 |

**Home** is the front door — links to the other three sites plus GitHub, Telegram, email, and YouTube.

**Résumé** covers web systems for data (APIs, PostgreSQL, Redis, interfaces, Linux). Available in English and Russian.

**Projects** lists work and personal systems as Markdown in the repo, with a page per project.

**Chat** is invite-gated. Message text and files are encrypted in the browser before they leave the device. A local vault (separate from the account password) holds identity keys and history; the vault password never goes to the server. Online traffic prefers WebRTC; a short-lived encrypted mailbox on the API covers offline delivery within a 5 GB cloud budget. Details: [ARCHITECTURE.md](docs/ARCHITECTURE.md), [PROTOCOL.md](docs/PROTOCOL.md), [THREAT_MODEL.md](docs/THREAT_MODEL.md).

<p align="center">
  <img src="docs/screenshots/home-dark.jpg" alt="Home in dark theme" width="420" />
  &nbsp;
  <img src="docs/screenshots/home-light.jpg" alt="Home in light theme" width="420" />
</p>

<p align="center">
  <img src="docs/screenshots/resume-dark.jpg" alt="Résumé" width="280" />
  &nbsp;
  <img src="docs/screenshots/projects-light.jpg" alt="Projects" width="280" />
  &nbsp;
  <img src="docs/screenshots/chat-signin-dark.jpg" alt="Chat sign-in" width="280" />
</p>

## Monorepo layout

```
apps/
  home/          ma.cyou
  resume/        me.ma.cyou
  projects/      projects.ma.cyou
  chat/          chat.ma.cyou (PWA)
packages/
  ui/            shared React UI, SkyBackdrop, tokens
  i18n/          English / Russian (i18next)
  content/       résumé JSON, project Markdown
  crypto/        libsodium vault and messaging crypto
  protocol/      shared schemas and limits
  api-client/    HTTP helpers for the Go API
  config/        shared Vite / tsconfig helpers
services/
  api/           Go API (REST, WebSocket, mailbox)
infra/
  dev/           local Postgres compose
  oracle/        production host bootstrap, nginx, coturn
e2e/             Playwright (home smoke)
docs/            architecture, deploy, ideas, screenshots
```

## Stack

| Layer | Technology |
| --- | --- |
| Apps | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Shared UI | Radix primitives, Inter / JetBrains Mono, canvas skies |
| Copy | i18next (+ ICU), EN + RU |
| Content | Zod-validated JSON / Markdown in `@ma/content` |
| Chat crypto | libsodium (Argon2id, XChaCha20-Poly1305, WebAuthn unlock) |
| API | Go, PostgreSQL 16, WebSocket signaling, on-disk mailbox |
| Frontends (prod) | Cloudflare Workers static assets (Wrangler) |
| API / TURN (prod) | Oracle Cloud ARM host, nginx, coturn |

## Local development

Requirements: **Node.js ≥ 22**, **pnpm 10**, **Go 1.23+**, and **Docker** for Postgres.

```bash
pnpm install
docker compose -f infra/dev/compose.yml up -d postgres
pnpm dev
```

API (separate terminal):

```bash
cd services/api
# PowerShell
$env:DEV_INSECURE_HTTP = "true"
$env:DATABASE_URL = "postgres://macyou:macyou@127.0.0.1:5432/macyou?sslmode=disable"
go run ./cmd/api
```

Create a chat invite: `go run ./cmd/admin invite create` from `services/api`.

`pnpm dev` proxies chat to port **8080** on the same host as the page. Production builds use `https://api.ma.cyou` unless `VITE_API_ORIGIN` is set. More: [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | All four Vite apps in parallel |
| `pnpm build` | Production build of every app |
| `pnpm lint` | ESLint across the workspace |
| `pnpm typecheck` | `tsc --noEmit` for apps and packages |
| `pnpm test` | Vitest unit / component tests |
| `pnpm test:e2e` | Playwright (home preview on :4173) |
| `pnpm content:check` | Content package tests |
| `pnpm format` / `format:check` | Prettier |

## Testing

- **Vitest** covers crypto, protocol limits, i18n key parity, content loading, UI smoke (including SkyBackdrop), and chat prefs/sync helpers.
- **Playwright** (`e2e/home.spec.ts`) hits a home preview server; see `playwright.config.ts`.
- Chat E2E with two browsers is still an open idea — see [IDEAS.md](docs/IDEAS.md).

## Deploy overview

No secrets belong in this repo. Env templates live under `infra/oracle/`.

**Frontends** — four Cloudflare Workers, each with a root Wrangler config pointing at that app's `dist/`:

| Worker `name` | Domain | Config |
| --- | --- | --- |
| `ma` | ma.cyou | `wrangler.home.jsonc` |
| `me` | me.ma.cyou | `wrangler.resume.jsonc` |
| `projects` | projects.ma.cyou | `wrangler.projects.jsonc` |
| `chat` | chat.ma.cyou | `wrangler.chat.jsonc` |

Build example: `pnpm --filter @ma/home... build` then `npx wrangler deploy --config wrangler.home.jsonc`. Each app ships `public/_headers` and `public/_redirects`.

**API** — `services/api` on an Ubuntu ARM64 host (`infra/oracle/bootstrap.sh`, systemd unit, nginx). Coturn for STUN/TURN/TURNS at `turn.ma.cyou`. DNS for `api.ma.cyou` / `turn.ma.cyou` stays DNS-only (grey-cloud). Postgres dumps via `infra/oracle/backup.sh`. Full steps: [DEPLOY.md](docs/DEPLOY.md).

## Contact

- Email: [me@ma.cyou](mailto:me@ma.cyou)
- GitHub: [Mapagmataas1331](https://github.com/Mapagmataas1331/)
- Telegram: [@mapagmataas](https://t.me/mapagmataas)
- YouTube: [@mapagmataas](https://youtube.com/@mapagmataas/)

## License

Copyright (c) 2022–2026 Timofey (Mapagmataas). All rights reserved. See [LICENSE](LICENSE).
