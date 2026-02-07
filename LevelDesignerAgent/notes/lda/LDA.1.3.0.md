# LDA.1.3.0 - Encrypted Secrets Vault

## Summary
Implements Phase 1 "Encrypted secrets vault" with AES-256-GCM encryption for storing sensitive keys (OpenAI, Gemini, etc.) and a minimal Admin UI to manage them.

## Changes
-   **Core**: Bumped version to `LDA.1.3.0`.
-   **API**:
    -   Added `SECRETS_MASTER_KEY` requirement for encryption.
    -   Implemented `AES-256-GCM` encryption/decryption utilities.
    -   Added `GET /admin/secrets` and `PUT /admin/secrets/:key` endpoints.
    -   Removed insecure logging of `DATABASE_URL` during migrations.
-   **Web**:
    -   Added Secrets Admin panel to list and update secrets.
-   **Worker**:
    -   Added startup check for `SECRETS_MASTER_KEY`.

## Verification Evidence
> To be filled after verification.

## Follow-ups
-   Phase 2: Use these secrets in the worker for actual AI generation.
