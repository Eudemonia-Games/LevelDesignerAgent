# LDA Phase 1 Verification Checklist (Render-First)

This document outlines the steps to verify the "Level Design Agent" (LDA) Phase 1 release (LDA.1.5.0).

## 1. Environment Variables (One-Time Setup)
Ensure the following variables are set in your Render dashboard or local `.env`.
> **SECURITY WARNING**: Never commit real values.

| Service | Variable | Description |
| :--- | :--- | :--- |
| **lda-api** | `DATABASE_URL` | Connection string to Neon Postgres (Pooled mode recommended). |
| | `ADMIN_USERNAME` | Username for admin login (default: `admin`). |
| | `ADMIN_PASSWORD_HASH` | Bcrypt hash of the admin password. |
| | `SESSION_COOKIE_SECRET` | 32+ char random string for signing cookies. |
| | `CORS_ORIGINS` | Comma-separated list of allowed origins (e.g., `https://lda-web.onrender.com`). |
| | `SECRETS_MASTER_KEY` | Base64-encoded 32-byte key for AES-256-GCM encryption. |
| **lda-worker** | `DATABASE_URL` | Same as API. |
| | `SECRETS_MASTER_KEY` | Same as API. |
| **lda-web** | `VITE_API_BASE_URL` | URL of the API service (e.g., `https://lda-api-dr40.onrender.com`). |

## 2. Render Verification Steps
Perform these checks on the live deployment.

- [ ] **API Health Check**
    - **Action**: Visit `https://<YOUR_API_URL>/health`
    - **Expect**: JSON response with `"version": "LDA.1.5.0"`, `"status": "ok"`, and `"db": { "status": "ok" }`.

- [ ] **Web Login**
    - **Action**: Visit `https://<YOUR_WEB_URL>`, enter admin credentials.
    - **Expect**: Successful login, redirection to the dashboard (Secrets Admin).

- [ ] **Session Cookie**
    - **Action**: Inspect browser storage (Application > Cookies).
    - **Expect**: `lda_session` cookie present with `Secure`, `HttpOnly`, and `SameSite=None` attributes.

- [ ] **Secrets Management**
    - **Action**: In the Web UI, view the secrets list.
    - **Expect**: Table lists keys (e.g., `OPENAI_API_KEY`) with masked values (`********`). Status shows "NOT SET" or "SET".
    - **Action**: Click "Edit", enter a value, click "Save".
    - **Expect**: Success message ("Saved ✓"), status changes to "SET" (or updates timestamp).

- [ ] **Worker Logs**
    - **Action**: Check Render Logs for `lda-worker`.
    - **Expect**: "db:migrate success" (if migrations ran) or "Worker started". **NO connection strings** should be visible.

## 3. Local Verification (Repo Mode)
Use these commands to verify the codebase locally.

### Build
```bash
pnpm -r build
```
Expect: Success for all packages (`shared`, `api`, `web`, `worker`).

### Start API
```bash
pnpm --filter @lda/api start
```
Expect: `API server listening on port 3000`.

### Health Check
```bash
curl http://localhost:3000/health
```
Expect: `{"status":"ok", ..., "version":"LDA.1.5.0", ...}`

### Log Hygiene Check
Scan logs for `postgresql://`.
Expect: **Zero matches.**

## 4. Common Pitfalls & Solutions

| Issue | Symptom | Fix |
| :--- | :--- | :--- |
| **DB Connection Fails** | "Connection terminated" or "unsupported param" | Ensure `DATABASE_URL` sanitizer is stripping `channel_binding`. Use Pooled connection string from Neon. |
| **CORS Error** | Browser console: "Blocked by CORS policy" | Verify `CORS_ORIGINS` on `lda-api` matches `lda-web` URL exactly (no trailing slash). Check Preflight `OPTIONS` are allowed. |
| **Login Loop** | Redirects back to login repeatedly | Check cookie attributes. Must be `SameSite=None` and `Secure=true` if Web/API are on different subdomains (like Render default). |
| **Secrets Error** | "Failed to fetch" or 500 when saving | Check `SECRETS_MASTER_KEY` on API. Check logs for "Invalid key length". |
