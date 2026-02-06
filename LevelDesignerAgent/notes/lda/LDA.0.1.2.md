# LDA.0.1.2 Release Notes

## Summary
This release focuses on fixing build and compatibility issues for the `worker` package in Render environments, and ensuring consistent workspace resolution across the monorepo. It also includes the previously planned CommonJS enforcement for API stability.

## Change Log

### shared
- **Config**: Added `exports` map to `package.json` to explicitly point to `dist/index.js` and types. This ensures it works correctly when imported by other packages in strict workspace setups.
- **Config**: Verified `declaration: true` and `outDir: dist` in `tsconfig.json`.

### worker
- **Config**: Set `moduleResolution: "Node"` in `tsconfig.json` to align with standard Node.js resolution and fix module finding issues.
- **Deps**: Confirmed `dependencies` on `@lda/shared` are correct (`workspace:*`).

### root
- **Scripts**: Added `build:worker` and `start:worker` convenience scripts.
    - `build:worker`: Builds shared then worker (simulating Render build command).
    - `start:worker`: Starts the worker.

### api / web
- **Deps**: Confirmed `dependencies` on `@lda/shared` are correct (`workspace:*`).

## Verification Evidence

### Local (Repo Mode) pass
- [x] `pnpm install`
- [x] `pnpm -r build`
- [x] `pnpm --filter @lda/worker start` (Should log version LDA.0.1.2)

### Render Mode Simulation
- [x] Clean dists: `rm -rf shared/dist worker/dist`
- [x] Install: `pnpm install`
- [x] Build shared: `pnpm --filter @lda/shared build`
- [x] Build worker: `pnpm --filter @lda/worker build`
- [x] Start worker: `pnpm --filter @lda/worker start`

## Follow-ups / TODOs
- Verify actual deployment on Render.
