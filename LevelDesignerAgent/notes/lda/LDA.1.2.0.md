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
User chose to verify directly on Render.

**Steps to Verify:**
1.  **Configure Environment Variables** on Render for `lda-api`:
    -   `ADMIN_USERNAME`: `admin` (or preferred)
    -   `ADMIN_PASSWORD_HASH`: (Output from `pnpm --filter @lda/api gen:admin-hash "your-password"`)
    -   `SESSION_COOKIE_SECRET`: (A long random string)
    -   `CORS_ORIGIN`: `https://your-lda-web.onrender.com`
    -   `DATABASE_URL`: (Your Neon DB connection string)
2.  **Deploy** `lda-api` and `lda-web`.
3.  **Visit Web URL**: Expect Login Screen.
4.  **Login**: Use configured credentials.
5.  **Verify**:
    -   System Status should show API connected.
    -   `lda_session` cookie should be present and `HttpOnly`.
    -   Refreshing page should maintain session.
    -   Logout should clear session.

## Follow-ups
-   Implement role-based access control (RBAC) if multiple user types are needed (current is single admin).
-   Add rate limiting to login endpoint.
