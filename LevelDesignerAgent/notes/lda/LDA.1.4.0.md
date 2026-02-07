# LDA.1.4.0 - Admin UI Polish & Log Hygiene

## Summary
Improved the Admin Secrets UI with better UX (copy buttons, status indicators, reliable updates) and handled session expiry. Hardened security by scrubbing database connection strings from all API and Worker logs.

## Changes
-   **Core**: Bumped version to `LDA.1.4.0`.
-   **Log Hygiene**: Removed `DATABASE_URL` logging from `api` and `worker` migration scripts.
-   **Web UI**:
    -   Added "Copy" button for secret keys.
    -   Improved "SET" / "NOT SET" status display.
    -   Added reliable "Saved ✓" feedback on update.
    -   Implemented session expiry handling (redirects to login on 401).
    -   Added Retry button for network errors.

## Verification Evidence
> To be filled after verification.

## Follow-ups
-   None immediatly. Ready for production use.
