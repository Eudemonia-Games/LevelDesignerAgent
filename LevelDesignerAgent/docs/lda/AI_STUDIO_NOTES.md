# AI Studio Notes - LDA

## LDA.0.1.0 - Bootstrap Monorepo

### Plan
Bootstrap the monorepo + tooling skeleton for LDA with packages: web, api, worker, shared. Use pnpm workspace, TypeScript, and basic scaffolding.

### Files changed
- [NEW] pnpm-workspace.yaml, package.json, tsconfig.base.json, .gitignore, .env.example
- [NEW] shared/ (package.json, tsconfig.json, src/version.ts, src/index.ts)
- [NEW] api/ (package.json, tsconfig.json, src/server.ts, src/index.ts)
- [NEW] worker/ (package.json, tsconfig.json, src/index.ts)
- [NEW] web/ (package.json, vite.config.ts, tsconfig.json, index.html, src/App.tsx, src/main.tsx)
- [NEW] .eslintrc.js, .github/workflows/ci.yml

### Mismatches
None.

### Limitations
- `pnpm` and `npm` were not found in the environment, so automated verification (install/build/lint) could not be performed by the agent. The user must verify locally.
- No real database or authentication yet.
- API health check is not yet wired into the Web UI.

### How to verify in Repo Mode
1. Install dependencies: `pnpm install`
2. Run tools: `pnpm -r lint && pnpm -r typecheck && pnpm -r build`
3. Run API: `pnpm -C api dev` -> http://localhost:3001/health
4. Run Worker: `pnpm -C worker dev` -> Check console
5. Run Web: `pnpm -C web dev` -> Check browser

### How to verify in Render Mode
N/A for LDA.0.1.0

## LDA.0.1.1 - Fix Build & Typecheck

### Plan
Fix TypeScript errors (TS6133, TS6059) and Vite build failures. Refactor `@lda/shared` to export built artifacts (`dist`) instead of source, ensuring strict workspace isolation.

### Files changed
- [MODIFY] web/src/App.tsx, web/vite.config.ts
- [MODIFY] tsconfig.base.json (Removed paths alias)
- [MODIFY] shared/package.json, shared/tsconfig.json
- [MODIFY] api/package.json, worker/package.json (Pre-build steps)
- [MODIFY] shared/src/version.ts (LDA.0.1.1)
- [NEW] docs/lda/WINDOWS_DEV.md

### Mismatches
None.

### Limitations
- Automated verification still limited by missing system dependencies in agent environment. User must verify locally.
- `api` and `worker` dev commands now require `shared` to be built first (handled automatically by script).

### How to verify in Repo Mode
1. Clean: `rm -rf **/dist`
2. Install: `pnpm install`
3. Checks: `pnpm -r lint && pnpm -r typecheck && pnpm -r build`
4. Runtime: `pnpm -C api dev` -> Verify version LDA.0.1.1

### How to verify in Render Mode
N/A for LDA.0.1.1

