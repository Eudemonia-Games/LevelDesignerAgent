# LDA.0.3.0 Release Notes

## Summary
LDA.0.3.0 enhances stability and visibility by introducing a "System Status" panel in the Web UI, enabling CORS on the API for cross-origin requests, and properly versioning the application. A release runbook for Render has also been added.

## Change Log

### Core
- **Version**: Bumped to `LDA.0.3.0` in `shared/src/version.ts`.
- **Scripts**: Added `build:web`, `build:api`, `build:worker`, `start:api` to root `package.json` for easier Render configuration.

### Web
- **Feature**: Added `SystemStatus` component to `App.tsx`.
- **Config**: Reads `VITE_API_BASE_URL` env var to fetch API health.
- **UI**: Displays live API status (OK/Error) and version.

### API
- **Feature**: Enabled CORS via `@fastify/cors`.
- **Config**: Added `CORS_ORIGIN` env var support (defaults to `*` for dev).

### Docs
- **New**: `docs/lda/RENDER_RUNBOOK.md` - Operational guide for Render.

## Verification Evidence

### Local (Repo Mode)
- [ ] `pnpm install` (Passed)
- [ ] `pnpm -r build` (Passed)
- [ ] API start: `pnpm start:api` -> Health OK (LDA.0.3.0)
- [ ] Web start: `VITE_API_BASE_URL=http://localhost:3001 pnpm --filter @lda/web dev`
    - UI shows "API: http://localhost:3001 | Health: OK (LDA.0.3.0)"

### Render Mode Simulation
- [ ] `pnpm install && pnpm build:api` -> Success
- [ ] `pnpm install && pnpm build:web` -> Success

## Follow-ups
- Deploy to Render and set `VITE_API_BASE_URL` on `lda-web` and `CORS_ORIGIN` on `lda-api`.
