# LDA.0.1.2 Release Notes

## Summary
This release focuses on platform stability for Render.com deployments. It transitions the API and Shared packages to producing CommonJS (CJS) output to eliminate ESM `ERR_MODULE_NOT_FOUND` runtime errors. It also pins the Node.js version to v22.22.0 to ensure consistency between local development and Render's runtime environment.

## Detailed Change Log

### Configuration
- **Node Version**: Pinned to `22.22.0` via `.nvmrc`.
- **API Build**: Switched `api/tsconfig.json` to `"module": "CommonJS"`, `"moduleResolution": "Node"`, and target `ES2020`.
- **Shared Build**: Switched `packages/shared/tsconfig.json` to `"module": "CommonJS"`.
- **Package Config**: Verified `@lda/api` does NOT use `"type": "module"`.

### Code
- **Version Bump**: `@lda/shared` version updated to `LDA.0.1.2`.

### Documentation
- Updated `WINDOWS_DEV.md` to reflect Node 22 requirement.
- Updated `AI_STUDIO_NOTES.md` with release plan.

## Verification Evidence (Planned)
- Local build passes: `pnpm -r build`
- Local API start: `node dist/index.js` (via pnpm start) runs without ESM errors.
- Render deploy: Successful boot and `/health` check returning `LDA.0.1.2`.

## Follow-ups / TODOs
- Monitor Render logs for any remaining warnings.
- Verify `web` package (Vite) still builds correctly consuming the CommonJS `shared` package.
