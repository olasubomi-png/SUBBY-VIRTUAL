# Environment reference

Configure runtime secrets through the VPS secret manager or a protected `.env` file; never commit credentials. The self-hosted runtime requires `DATABASE_URL`, `JWT_SECRET`, and `AUTH_BOOTSTRAP_ADMIN_EMAIL`. `HOST=127.0.0.1` and `PORT=3003` are the dedicated VPS binding used behind Nginx. `REDIS_URL` is recommended for distributed rate limiting, while the Forge variables are needed only by the existing server-side integrations. The application does not require `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, or `OWNER_OPEN_ID`.

`AUTH_BOOTSTRAP_ADMIN_EMAIL` is normalized to lowercase and trimmed. The first newly created account matching that address receives the `admin` role; later accounts receive the normal `user` role. `JWT_SECRET` signs the HTTP-only `app_session_id` cookie and must be a long random server-only value, such as one generated with `openssl rand -base64 48`.

The application intentionally keeps SMS and mail provider credentials unset in Phase 1. Those workflows use the existing mock providers and do not send live messages or process payments.
