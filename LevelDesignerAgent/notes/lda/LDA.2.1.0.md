# LDA.2.1.0 Release Notes

**Date:** 2026-02-07
**Version:** LDA.2.1.0
**Focus:** Phase 2 Foundation - Flow & Stage Persistence

## Summary
This release marks the beginning of Phase 2 (Agent Core). It introduces the database schema and API endpoints for managing Design Flows (`flow_versions`) and Stage Templates (`flow_stage_templates`). It also includes an idempotent seeding mechanism to ensure the default "Boss Room" flow is always present.

## Changes

### 1. Database & Schema
- **Tables**: Confirmed existence of `flow_versions` and `flow_stage_templates` in schema.
- **Seeding**: Added `api/src/db/seed.ts` which runs on server startup.
    - Ensures `bossroom_default` (v0.1.0) exists.
    - Seeds default **16-stage pipeline** (`S1_PROMPT_ENHANCE` ... `S15_BUILD_MANIFEST`) from the Design Specification.
    - Performs cleanup of obsolete stages if schema changes.
- **Helpers**: Added `api/src/db/flows.ts` for standardized DB access (using `pg`).

### 2. API Endpoints (`/design`)
Authentication is **required** for all endpoints.

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/design/flows` | List all flows (ordered by name/version). |
| `POST` | `/design/flows` | Create a new flow version. |
| `PUT` | `/design/flows/:id` | Update flow metadata (description). |
| `POST` | `/design/flows/:id/clone` | Deep clone a flow and its stages to a new patch version. |
| `POST` | `/design/flows/:id/publish` | Mark a flow as published (unpublishes others of same name). |
| `GET` | `/design/flows/:flowId/stages` | List stages for a flow. |
| `PUT` | `/design/flows/:flowId/stages/:stageKey` | Upsert (Create/Update) a stage template. |

### 3. Hardening
- **Validation**: Introduced `zod` for request validation.
- **Transactions**: Cloning and Publishing use DB transactions for data integrity.

## Verification Evidence

### Local Verification
Performed using `verify_lda_2_1_0.js` against local API.

**1. Login**
> Status: 200 OK

**2. List Flows**
> Returns seeded data + created test flows.
> `[{"name":"bossroom_default", "is_published":true, ...}]`

**3. CRUD Operations**
- **Create**: Success (200)
- **Update**: Success (200)
- **Upsert Stage**: Success (200)

**4. Complex Operations**
- **Clone**: Successfully copied flow and stages. New version patch incremented.
- **Publish**: Successfully set `is_published=true` and unset others.

### Curl Commands for Manual Check

**Login:**
```bash
curl -c cookies.txt -H "Content-Type: application/json" -d '{"username":"admin","password":"password"}' http://localhost:3001/auth/login
```

**List Flows:**
```bash
curl -b cookies.txt http://localhost:3001/design/flows
```

**Get Stages:**
```bash
# Replace FLOW_ID with valid UUID from List Flows
curl -b cookies.txt http://localhost:3001/design/flows/<FLOW_ID>/stages
```

## Known Issues / Follow-ups
- **Zod**: Pinned to `3.24.1` to avoid package manager issues.
