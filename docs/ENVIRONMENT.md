# Environment reference

Configure the scaffold-provided secrets through the WebDev project settings or a VPS secret manager. The Phase 1 runtime uses `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, and `VITE_OAUTH_PORTAL_URL`. Do not commit `.env` files. Local Docker service credentials should remain development-only and be replaced with managed secrets in deployment.
