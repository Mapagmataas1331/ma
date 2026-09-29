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

Edit `/etc/macyou/api.env` from `infra/oracle/api.env.example`. Generate `SERVER_KEK` and `TURN_SECRET` with `openssl rand -base64 32`. Generate VAPID keys with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` for browser push. DNS for `api.ma.cyou` and `turn.ma.cyou` must be grey-cloud (DNS only) so TLS-ALPN/HTTP-01 and TURN see the real client.

Open on the Oracle security list (or NSG): TCP 22, 80, 443; TCP+UDP 3478; TCP 5349; UDP 49160–49400. Do not expose API port 8080 publicly.

After DNS for `turn.ma.cyou` points at the host:

```bash
sudo bash infra/oracle/coturn/install-coturn.sh   # STUN/TURN on 3478
sudo bash infra/oracle/coturn/setup-turns.sh      # Let's Encrypt + TURNS on 5349, updates TURN_URLS
```

GitHub Actions `api-deploy.yml` builds `linux/arm64` and restarts `macyou-api` when `ORACLE_HOST` and `ORACLE_SSH_KEY` are set.

## Backups

`infra/oracle/backup.sh` dumps PostgreSQL only. Mailbox blobs are temporary and are not backed up.

Restore drill: `zstd -dc backup.sql.zst | sudo -u postgres psql macyou`, then `curl -fsS https://api.ma.cyou/healthz`.

## Local

See [DEVELOPMENT.md](DEVELOPMENT.md).
