# Deploy

## Frontends

Create four Cloudflare Pages projects from this repo.

| App | Build command | Output |
| --- | --- | --- |
| home | `pnpm install --frozen-lockfile && pnpm --filter @ma/home... build` | `apps/home/dist` |
| resume | `pnpm install --frozen-lockfile && pnpm --filter @ma/resume... build` | `apps/resume/dist` |
| projects | `pnpm install --frozen-lockfile && pnpm --filter @ma/projects... build` | `apps/projects/dist` |
| chat | `pnpm install --frozen-lockfile && pnpm --filter @ma/chat... build` | `apps/chat/dist` |

Attach `ma.cyou`, `me.ma.cyou`, `projects.ma.cyou`, and `chat.ma.cyou`. `_headers` and `_redirects` ship from each `public/` folder.

## API

On a fresh Ubuntu 24.04 ARM64 host:

```bash
sudo bash infra/oracle/bootstrap.sh
```

Edit `/etc/macyou/api.env` from `infra/oracle/api.env.example`. Generate `SERVER_KEK` with `openssl rand -base64 32` and a TURN secret the same way. DNS for `api.ma.cyou` and `turn.ma.cyou` must be grey-cloud so TLS-ALPN/HTTP-01 and TURN see the real client.

GitHub Actions `api-deploy.yml` builds `linux/arm64` and restarts `macyou-api` when `ORACLE_HOST` and `ORACLE_SSH_KEY` are set.

## Backups

`infra/oracle/backup.sh` dumps PostgreSQL only. Mailbox blobs are temporary and are not backed up.

Restore drill: `zstd -dc backup.sql.zst | sudo -u postgres psql macyou`, then `curl -fsS https://api.ma.cyou/healthz`.

## Local

See [DEVELOPMENT.md](DEVELOPMENT.md).
