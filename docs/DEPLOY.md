# Deploy

## Frontends

Create four Cloudflare Workers from this repo. The root directory is `/`. The Worker name in the dashboard must match `name` in the Wrangler file. Pages already installs dependencies, so the build command only compiles that app.

| Worker | Domain | Config | Build command | Deploy command |
| --- | --- | --- | --- | --- |
| `ma` | [ma.cyou](https://ma.cyou) | `wrangler.home.jsonc` | `pnpm --filter @ma/home... build` | `npx wrangler deploy --config wrangler.home.jsonc` |
| `me` | [me.ma.cyou](https://me.ma.cyou) | `wrangler.resume.jsonc` | `pnpm --filter @ma/resume... build` | `npx wrangler deploy --config wrangler.resume.jsonc` |
| `projects` | [projects.ma.cyou](https://projects.ma.cyou) | `wrangler.projects.jsonc` | `pnpm --filter @ma/projects... build` | `npx wrangler deploy --config wrangler.projects.jsonc` |
| `chat` | [chat.ma.cyou](https://chat.ma.cyou) | `wrangler.chat.jsonc` | `pnpm --filter @ma/chat... build` | `npx wrangler deploy --config wrangler.chat.jsonc` |

`_headers` and `_redirects` ship from each `public/` folder. Leave `api.ma.cyou` on the Oracle server.

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
