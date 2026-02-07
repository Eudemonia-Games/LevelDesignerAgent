# LDA.1.5.0 Release Notes

**Date**: 2026-02-07
**Version**: LDA.1.5.0
**Focus**: Phase 1 Lock, Hardening, Verification.

## 🚀 Summary
This release marks the completion of **Phase 1: Infrastructure**. It solidifies the foundation (Auth, DB, Secrets) by hardening database connections against known Render/Neon issues (invalid query params) and scrubbing logs for security. It also establishes the documentation required for the Phase 2 (Agent Core) handoff.

## 📋 Change Log
### Hardening
- **[NEW] Database Sanitizer**: Centralized utility (`api/src/db/utils.ts`) to strip `channel_binding` from connection strings, fixing compatibility with Node `pg`.
- **[SEC] Log Hygiene**: Removed all instances where `DATABASE_URL` or connection strings were logged to the console in both API and Worker services.
- **[FIX] API/Worker Startup**: Updated entry points to use the sanitized connection config.

### Documentation
- **[NEW] `docs/lda/PHASE1_VERIFY.md`**: A comprehensive checklist for verifying the deployment on Render and locally.
- **[UPDATE] `docs/lda/03_Current_Phase_Plan.md`**: Transitioned roadmap to Phase 2 (Agent Core).
- **[APPEND] `docs/lda/04_Development_Summary.md`**: Added Phase 1 completion summary.

## ✅ Verification Evidence

### 1. Build Verification
Command: `pnpm -r build`
Result: **Success**
```text
shared build: Done
web build: ✓ built in 565ms
api build: Done
worker build: Done
```

### 2. Local Environment Check
*Pending manual verification after release.*
- Health Check: `curl http://localhost:10000/health` -> Expect `LDA.1.5.0`
- Log Check: No `postgresql://` in output.

## 🔜 Next Steps
- Deploy `LDA.1.5.0` to Render.
- Execute the **Render Verification Steps** in `docs/lda/PHASE1_VERIFY.md`.
- Begin Phase 2: **LDA.2.1.0** (Agent Skeleton).
