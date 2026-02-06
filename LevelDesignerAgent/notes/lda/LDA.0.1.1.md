# LDA.0.1.1

## Summary
Fixed TypeScript build errors (TS6133, TS6059) and Vite configuration issues. Refactored workspace resolution to usage built artifacts (`dist`) from `@lda/shared`, ensuring proper isolation and fixing rootDir errors. Added Windows development guide.

## Detailed change log
- **Web**: Removed unused React import in `App.tsx`. Fixed `vite.config.ts` imports.
- **Workspace**: Removed `paths` alias from `tsconfig.base.json`.
- **Shared**: Configured `package.json` to export `./dist` output. Enabled declaration emit.
- **API/Worker**: Updated `dev` scripts to build `shared` dependency before starting.
- **Docs**: Added `docs/lda/WINDOWS_DEV.md`.

## Verification evidence
**NOTE: Automated verification failed because `pnpm` is not in the system path.**

Please perform the following verification steps:

### 1. Clean Build & Check
```bash
# Clean dist folders (PowerShell)
Get-ChildItem -Recurse -Include dist | Remove-Item -Recurse -Force

# Run Checks
pnpm install
pnpm -r lint
pnpm -r typecheck
pnpm -r build
```
Expected output: All commands pass without error.

### 2. Runtime Check
```bash
pnpm -C api dev
curl http://localhost:3001/health
```
Expected output:
```json
{"status":"ok","service":"api","version":"LDA.0.1.1"}
```

## Follow-ups / TODOs
- [ ] Wire up Web UI to fetch data from API (LDA.0.2.0)
