# LDA.1.2.0 - Admin Auth

## Summary
Introduced admin authentication for the API and Web interface. The system now requires a login to access any functionality beyond the health check.

## Changes
-   **API**:
    -   Added `auth_sessions` table (previously defined in schema, now utilized).
    -   Implemented `AuthService` for session management (DB-backed, signed httpOnly cookies).
    -   Added endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
    -   Implemented Global Route Guard (denies all except `/health` and `/auth/login`).
    -   Added `DATABASE_URL` sanitizer to migration runners to handle `channel_binding` param.
-   **Web**:
    -   Added `Login` component.
    -   Integrated auth state into `App`.
    -   Added `Logout` button.
-   **Config**:
    -   Updated `.env.example` with required auth variables.
    -   Added `gen:admin-hash` script to API.

## Verification Evidence
### Render Deployment
**Verified Successfully on 2026-02-07**

**Steps Verified:**
1.  **Environment Configured**: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_COOKIE_SECRET`, `CORS_ORIGIN`, `DATABASE_URL`.
2.  **Deployment**: `lda-api` and `lda-web` deployed successfully.
3.  **Login Flow**:
    -   Accessed Web URL -> Redirected to Login.
    -   Logged in with `admin` / `admin`.
    -   Redirected to Dashboard (System Status: OK).
    -   `lda_session` cookie confirmed present and HttpOnly.
4.  **Logout**: Successfully cleared session and returned to login.

**CORS Note**: `server.ts` was patched to support trailing slash stripping and better logging during verification.

## Follow-ups
-   Implement role-based access control (RBAC) if multiple user types are needed (current is single admin).
-   Add rate limiting to login endpoint.
