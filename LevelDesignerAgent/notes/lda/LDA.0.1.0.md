# LDA.0.1.0

## Summary
Bootstrapped the Level Designer Agent (LDA) monorepo with `pnpm` workspaces. Created scaffolding for `api`, `web`, `worker`, and `shared` packages. Configured TypeScript, ESLint, and GitHub Actions.

## Detailed change log
- **Root**: Initialized `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`.
- **@lda/shared**: Created shared library with canonical version `LDA.0.1.0`.
- **@lda/api**: Created Fastify server scaffold with `/health` endpoint.
- **@lda/worker**: Created minimal worker script with startup banner.
- **@lda/web**: Created Vite + React app displaying the current version.
- **Tooling**: Added `.eslintrc.js` and `.github/workflows/ci.yml`.

## Verification evidence
**NOTE: Automated verification failed because `pnpm` is not in the system path.**

Please run the following commands manually:

### 1. Build & Lint
```bash
pnpm install
pnpm -r lint
pnpm -r typecheck
pnpm -r build
```
Expected output: All commands complete successfully.

### 2. API Check
```bash
pnpm -C api dev
curl http://localhost:3001/health
```
Expected output:
```json
{"status":"ok","service":"api","version":"LDA.0.1.0"}
```

### 3. Worker Check
```bash
pnpm -C worker dev
```
Expected output:
```
[Worker] Starting up... Version: LDA.0.1.0
```

## Follow-ups / TODOs
- [ ] Wire up Web UI to fetch data from API (LDA.0.2.0)
- [ ] Add deployment configuration for Render (LDA.0.2.0)

## ERRATA (Post-Verification Fixes)
- **Module Resolution**: Added `paths` alias to `tsconfig.base.json` and `web/vite.config.ts` to correctly resolve `@lda/shared` source during development.
- **TS Config**: Overrode `allowImportingTsExtensions: false` in `api`, `worker`, and `shared` tsconfigs to resolve conflicts with `noEmit: false`.

## 🚨 Troubleshooting
If you see errors like `Cannot find name 'process'` or `pnpm not recognized`, it is because **Node.js is not installed or configured**.

**Solution:**
1.  **Install Node.js**: Download and install the LTS version from [nodejs.org](https://nodejs.org/).
    *   During installation, ensure "Add to PATH" is selected.
2.  **Restart Terminal**: Close and reopen your terminal/VS Code to reload the PATH.
3.  **Install pnpm**:
    If you see a "SecurityError" or "cannot be loaded because running scripts is disabled", run this first:
    ```powershell
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    ```
    Then run:
    ```bash
    npm install -g pnpm
    pnpm install
    ```
4.  **Verify**: Run `pnpm -r build` to ensure everything works.
