# LDA.0.3.1 Release Notes

## Summary
LDA.0.3.1 resolves a critical issue where the Web application failed to load in browsers due to CommonJS incompatibility ("require is not defined"). The shared package has been refactored to support dual builds: ESM for Web and CommonJS for API/Worker.

## Change Log

### Shared
- **Build**: Implemented dual build system using `tsconfig.esm.json` and `tsconfig.cjs.json`.
- **Config**: Updated `package.json` exports to conditionaly provide ESM or CJS based on consumer environment.
- **Version**: Bumped to `LDA.0.3.1`.

### Web
- **Fix**: Added placeholder `favicon.ico` to prevent 404s.

## Verification Evidence

### Local (Repo Mode)
- [ ] `pnpm -r build` -> Successful (Shared builds both ESM and CJS).
- [ ] Web Dev: `pnpm --filter @lda/web dev` -> Loads without console errors. Status panel shows `LDA.0.3.1`.
- [ ] API Start: `pnpm start:api` -> Starts successfully (using CJS).

### Render Mode Simulation
- [ ] Redeploy Web -> Should render correctly.

## Follow-ups
- Monitor Render deployments to ensure API/Worker still pick up CJS correctly.
