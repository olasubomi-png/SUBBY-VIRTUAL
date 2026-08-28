# SUBBY VIRTUAL Phase 1 VPS Deployment

This guide prepares the existing **mock-only Phase 1** application for a single Ubuntu Linux VPS at `subomivirtual.kdns.fr`. It does not deploy the application, apply migrations, create DNS records, provision a certificate, or enable live SMS, email, payments, or real-money funding.

> **Production process.** The repository has one production entry point: `pnpm start`, which executes `node dist/index.js` with `NODE_ENV=production`. PM2 runs that same compiled entry point once; it does not create a worker fleet or a second application process. Authentication is self-hosted email/password; no external OAuth portal or callback is required.

## Deployment model

| Layer                   | Phase 1 responsibility                                                                                     | Network exposure                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Nginx                   | Public HTTPS termination and reverse proxy for `subomivirtual.kdns.fr`                                     | Public ports `80` and `443` only         |
| Node.js / SUBBY VIRTUAL | React static assets, Express, tRPC, local email/password auth, `/health`, and cron-only dispatch endpoints | `127.0.0.1:3003` for this VPS deployment |
| PostgreSQL              | Durable production source of truth                                                                         | Localhost or private network only        |
| Redis                   | Recommended distributed rate-limit storage                                                                 | Localhost or private network only        |
| PM2                     | One production process, restart management, and logs                                                       | No public port                           |

The committed Nginx bootstrap configuration is [`deploy/nginx/subomivirtual.kdns.fr.conf`](../deploy/nginx/subomivirtual.kdns.fr.conf). It proxies to the loopback-bound application and forwards `Host`, real IP, and forwarded protocol headers as required by the proxy configuration.[1]

## 1. VPS prerequisites

Use an Ubuntu LTS VPS with a non-root operator account that has `sudo`. Before proceeding, point the DNS `A`/`AAAA` record for `subomivirtual.kdns.fr` to the VPS public address and confirm that SSH access still works.

Install baseline packages. Install **Node.js 22 or newer** through your organization-approved Node distribution, then confirm its version before using Corepack and pnpm.

```sh
sudo apt update
sudo apt install -y git curl build-essential nginx postgresql postgresql-contrib redis-server ufw snapd
node --version
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm --version
```

Do not expose PostgreSQL, Redis, or the Node application port through a cloud-provider firewall or UFW.

## 2. PostgreSQL setup

The production database dialect is **PostgreSQL only**. The application rejects a missing or non-PostgreSQL `DATABASE_URL` in production rather than silently using the in-memory development fallback. Local database URLs use no TLS; a non-local PostgreSQL endpoint uses certificate verification.

Create a dedicated role and database without placing the password in shell history. PostgreSQL prompts for the password interactively.

```sh
sudo -u postgres createuser --pwprompt subby_app
sudo -u postgres createdb --owner=subby_app subby_virtual
sudo -u postgres psql -c "ALTER ROLE subby_app SET client_encoding TO 'UTF8';"
```

For this one-VPS design, use a loopback URL in `/var/www/subby-virtual/.env`:

```dotenv
DATABASE_URL=postgresql://subby_app:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/subby_virtual
```

For a separately hosted PostgreSQL service, use its TLS-required connection string and keep the provider certificate chain valid. Do not change the codebase to MySQL or TiDB.

## 3. Clone, install, and configure the application

The repository is public, but its runtime `.env` file is ignored by Git. Clone it into a stable application directory, install lockfile-pinned dependencies, copy the tracked credential-free template, and lock down the resulting secret file.

```sh
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
git clone https://github.com/olasubomi-png/SUBBY-VIRTUAL.git /var/www/subby-virtual
cd /var/www/subby-virtual
pnpm install --frozen-lockfile
cp deploy/env.example .env
chmod 600 .env
```

Edit `.env` on the VPS. The following table distinguishes required production values from optional or platform-provided values.

| Variable                                                     | Requirement                                           | Notes                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                   | Required                                              | Set to `production`.                                                                                             |
| `HOST`                                                       | Required for this VPS design                          | Set to `127.0.0.1`; Nginx owns public HTTPS.                                                                     |
| `PORT`                                                       | Required for this VPS design                          | Set to `3003`; do not open it publicly. Production fails rather than choosing a surprise fallback port.          |
| `DATABASE_URL`                                               | Required                                              | A real `postgres://` or `postgresql://` URL.                                                                     |
| `REDIS_URL`                                                  | Recommended                                           | Loopback/private Redis for distributed rate limits; configured Redis fails closed if unavailable.                |
| `JWT_SECRET`                                                 | Required                                              | Generate a long random server-only value, for example `openssl rand -base64 48`.                                 |
| `AUTH_BOOTSTRAP_ADMIN_EMAIL`                                 | Required for initial administrator bootstrap          | The first signup matching this normalized address receives the `admin` role; subsequent accounts receive `user`. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`           | Only when the existing integration needs them         | Server-only values; do not prefix the server key with `VITE_`.                                                   |
| `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Only when the existing browser integration needs them | Values prefixed `VITE_` are build-time browser-visible; do not place database URLs or private credentials here.  |
| `APP_URL`                                                    | Operational reference                                 | Set to `https://subomivirtual.kdns.fr`; the current Phase 1 runtime does not read it directly.                   |
| `SMS_PROVIDER_API_KEY`, `MAIL_PROVIDER_API_KEY`              | Leave unset                                           | Phase 1 is intentionally mock-only.                                                                              |

The root `.gitignore` already ignores `.env` and common environment-file variants. Do not commit runtime credentials.

## 4. Apply and verify migrations

Review the committed PostgreSQL migration files before applying them. Production uses the already-generated migration sequence, not `pnpm db:push`, because `db:push` first generates migrations and is intended for schema development.

```sh
cd /var/www/subby-virtual
pnpm db:migrate
sudo -u postgres psql -d subby_virtual -c '\dt'
sudo -u postgres psql -d subby_virtual -c 'SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;'
```

Confirm that all committed migrations through `0008_dapper_shinobi_shaw.sql` have been applied before relying on password-backed local accounts and durable stale-job recovery metadata. This repository preparation does **not** claim that the migrations are applied on any VPS.

## 5. Build and run with PM2

Build before starting PM2. The committed [`ecosystem.config.cjs`](../ecosystem.config.cjs) runs one forked `SUBBY-VIRTUAL` process from `dist/index.js`, fixes `NODE_ENV=production`, `HOST=127.0.0.1`, and `PORT=3003`, enables automatic restart, disables file watching, and contains no credentials.

```sh
cd /var/www/subby-virtual
pnpm build
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs SUBBY-VIRTUAL
```

Use these operations after configuration changes or releases:

```sh
pm2 restart SUBBY-VIRTUAL --update-env
pm2 reload SUBBY-VIRTUAL --update-env
pm2 logs SUBBY-VIRTUAL
pm2 status
pm2 save
pm2 startup
```

Run the final command printed by `pm2 startup` with `sudo`, then repeat `pm2 save`. PM2 sends termination signals on restart; the application closes its Redis client, PostgreSQL pool, and HTTP server during `SIGTERM` or `SIGINT`.

## 6. Nginx and HTTPS

Install the bootstrap HTTP site before asking Certbot to install certificates. The configuration intentionally contains no certificate paths before Certbot runs.

```sh
sudo cp /var/www/subby-virtual/deploy/nginx/subomivirtual.kdns.fr.conf /etc/nginx/sites-available/subomivirtual.kdns.fr
sudo ln -s /etc/nginx/sites-available/subomivirtual.kdns.fr /etc/nginx/sites-enabled/subomivirtual.kdns.fr
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Nginx forwards the original host and HTTPS protocol to the loopback service. Express trusts exactly one proxy hop in production; this is appropriate only while Nginx is the sole local reverse proxy. Do not make the Node process publicly reachable, and do not send untrusted direct traffic to `127.0.0.1:3003`.

Once DNS resolves to the VPS and port `80` is publicly reachable, install Certbot using its current official instructions and let its Nginx integration create the HTTPS virtual host and HTTP-to-HTTPS redirect.[2]

```sh
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d subomivirtual.kdns.fr
sudo certbot renew --dry-run
```

Certbot’s HTTP validation requires a reachable HTTP site on port `80`; its Nginx integration can install the certificate and redirect configuration.[2] Do not claim a certificate exists until these commands succeed on the VPS.

## 7. Firewall

Allow SSH before enabling UFW, then expose Nginx only. PostgreSQL `5432`, Redis `6379`, and Node `3003` remain private.

```sh
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Also verify the VPS provider’s firewall/security group permits only the intended public ports.

## 8. Health and scheduled jobs

The public `GET /health` endpoint returns a safe liveness payload with `providerMode`, safe database mode/reachability information, and scheduled dispatcher readiness. It never returns credentials, connection strings, secrets, or stack traces.

```sh
curl --fail --silent --show-error http://127.0.0.1:3003/health
curl --fail --silent --show-error https://subomivirtual.kdns.fr/health
```

The job dispatcher is request-driven. PM2 starts the route and safe startup guard, but it deliberately does **not** introduce an in-process timer. Stale recovery runs before authenticated `POST /api/scheduled/dispatch-jobs` dispatches queued work. Therefore, configure the existing cron-only caller supported by the application’s Manus identity after the VPS endpoint is reachable; do not replace it with an unauthenticated server cron or browser tab. Record and monitor the scheduler identity and failures separately from PM2. This authentication-dependent scheduler connection is a manual production prerequisite, not a completed result of repository preparation.

## 9. Production smoke-test checklist

| Check                            | Expected result                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `https://subomivirtual.kdns.fr/` | Application is reachable over HTTPS.                                                                                     |
| `http://subomivirtual.kdns.fr/`  | Redirects to HTTPS after Certbot configuration.                                                                          |
| Sign-in and sign-out             | Session cookies work through Nginx and HTTPS.                                                                            |
| `/health`                        | Safe JSON reports `status: ok`, PostgreSQL mode/reachability, and ready dispatcher.                                      |
| `pnpm db:migrate`                | Completes on real PostgreSQL, with migrations through `0007`.                                                            |
| Mock SMS and demo email          | Create and queue through the existing authenticated UI/job path only.                                                    |
| Wallet and admin                 | Wallet operations remain mock/demo-safe; admin RBAC rejects non-admins.                                                  |
| PM2 restart                      | `pm2 restart SUBBY-VIRTUAL --update-env` returns the app to healthy state.                                               |
| PostgreSQL restart persistence   | Create controlled mock records, restart PM2, then verify the same owner sees durable data and a different user does not. |
| Dispatcher                       | An authenticated scheduled call completes/retries/recoveries without a browser remaining open.                           |

## 10. Updates and rollback

Before updating, capture the current Git SHA and back up the PostgreSQL database using the server’s documented backup policy. Use migrations only in the forward direction; do not edit historical migration files.

```sh
cd /var/www/subby-virtual
git rev-parse HEAD
git fetch origin
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 reload SUBBY-VIRTUAL --update-env
curl --fail --silent --show-error https://subomivirtual.kdns.fr/health
```

If the application release must be rolled back, return the code to the previously recorded Git SHA, reinstall dependencies, rebuild, and reload PM2. Do **not** roll back PostgreSQL schema or data casually: database rollback requires a separately rehearsed, backup-based restoration procedure compatible with every applied migration.

```sh
cd /var/www/subby-virtual
git checkout <PREVIOUS_VERIFIED_SHA>
pnpm install --frozen-lockfile
pnpm build
pm2 reload SUBBY-VIRTUAL --update-env
```

## 11. Repository-preparation verification

This repository-preparation pass did not contact the VPS or a production database. It verified the compiled production command locally with `NODE_ENV=production`, `HOST=127.0.0.1`, and a temporary port. The process bound only to `127.0.0.1`, returned the safe `/health` payload, and reported the scheduled HTTP dispatcher ready. The local environment identified its configured non-PostgreSQL development endpoint as unsupported, as expected; this is not evidence of a production PostgreSQL connection.

The final repository checks passed `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build`. The test suite includes binding, PM2, Nginx-template, environment-template, scheduled-endpoint, persistence-mode, job-reliability, authorization, and privacy coverage. The only build advisory is the existing non-blocking client chunk-size warning.

## References

[1] [NGINX reverse-proxy documentation](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

[2] [Certbot Nginx on Linux instructions](https://certbot.eff.org/instructions?os=snap&tab=standard&ws=nginx)
