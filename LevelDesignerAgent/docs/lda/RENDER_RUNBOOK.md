# Render Runbook

Operational guide for managing LDA services on Render.

## Services

### lda-api (Web Service)
- **Repo**: LevelDesignerAgent
- **Root Directory**: `.` (Monorepo root)
- **Build Command**: `pnpm install && pnpm build:api`
- **Start Command**: `pnpm start:api`
- **Environment Variables**:
    - `NODE_VERSION`: `22.22.0` (Recommended)
    - `CORS_ORIGIN`: `https://<lda-web>.onrender.com` (Your deployed web URL)

**Health Check**:
- URL: `https://<lda-api>.onrender.com/health`
- Response: `{"status":"ok","service":"api","version":"LDA.0.3.0"}`

### lda-web (Static Site)
- **Repo**: LevelDesignerAgent
- **Root Directory**: `.`
- **Build Command**: `pnpm install && pnpm build:web`
- **Publish Directory**: `web/dist`
- **Environment Variables**:
    - `VITE_API_BASE_URL`: `https://<lda-api>.onrender.com` (Your deployed API URL)

**Verification**:
- Open the deployed URL.
- Check the top "System Status" panel.
- Should show: **API: https://... | Health: OK (LDA.0.3.0)**

### lda-worker (Background Worker)
- **Repo**: LevelDesignerAgent
- **Root Directory**: `.`
- **Build Command**: `pnpm install && pnpm build:worker`
- **Start Command**: `pnpm start:worker`

**Logs**:
- Look for: `[Worker] Starting up... Version: LDA.0.3.0`
