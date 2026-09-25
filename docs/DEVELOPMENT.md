# Development

This repository is a pnpm workspace. Four Vite apps share UI, copy, and content packages. Chat also talks to one Go API.

[![Node](https://img.shields.io/badge/node-%3E%3D22-339933)](../package.json)
[![pnpm](https://img.shields.io/badge/pnpm-10-f69220)](../package.json)

## Stack

| Layer | Technology |
| --- | --- |
| Apps | React 19, TypeScript, Vite, Tailwind CSS |
| Shared UI | Radix primitives, styled in `@ma/ui` |
| Copy | i18next, English first, Russian second |
| Content | JSON and Markdown in `@ma/content` |
| Chat crypto | libsodium (Argon2id, XChaCha20-Poly1305) |
| API | Go, PostgreSQL 16, WebSocket signaling |

## Layout

| Package | Public site | Dev server |
| --- | --- | --- |
| `apps/home` | [ma.cyou](https://ma.cyou) | http://localhost:5173 |
| `apps/resume` | [me.ma.cyou](https://me.ma.cyou) | http://localhost:5174 |
| `apps/projects` | [projects.ma.cyou](https://projects.ma.cyou) | http://localhost:5175 |
| `apps/chat` | [chat.ma.cyou](https://chat.ma.cyou) | http://localhost:5176 |
| `services/api` | [api.ma.cyou](https://api.ma.cyou) | http://localhost:8080 |

Shared packages live under `packages/`: `ui`, `i18n`, `content`, `crypto`, `protocol`, `api-client`.

## Local development

Requirements: Node.js 22, pnpm 10, Go 1.23, and Docker for Postgres.

```bash
pnpm install
docker compose -f infra/dev/compose.yml up -d postgres
pnpm dev
```

In another terminal:

```bash
cd services/api
# PowerShell
$env:DEV_INSECURE_HTTP = "true"
$env:DATABASE_URL = "postgres://macyou:macyou@127.0.0.1:5432/macyou?sslmode=disable"
go run ./cmd/api
```

Create a chat invite with `go run ./cmd/admin invite create` from `services/api`.

`pnpm dev` sends chat requests to port 8080 on the same host as the page. Open the site by this computer's LAN address on a phone, and the API uses that address too. A production build uses `https://api.ma.cyou` unless `VITE_API_ORIGIN` is set.

Open the apps at `http://localhost`, not `http://127.0.0.1`. The Vite servers listen on IPv6 localhost.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev servers for all four apps |
| `pnpm build` | Production build of all four apps |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |

## Further notes

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the apps, API, and encryption fit together
- [PROTOCOL.md](PROTOCOL.md) — signaling frames and envelopes
- [THREAT_MODEL.md](THREAT_MODEL.md) — what the server can and cannot see
- [DEPLOY.md](DEPLOY.md) — Cloudflare Pages and the API host
