# LDA — Overall Phase Plan (v0.1)

Render-first development roadmap for **Level Design Agent (LDA)** with a **hybrid structure**:
- **Platform + integrations + pages first**
- **Flow-stage implementation later** (after platform is stable)

**Date:** 2026-02-06  
**Status:** Draft  
**Development environment:** Google AntiGravity for authoring + refactors, **Render for the real test loop**  
**Persistence:** Neon Postgres (system of record) + Cloudflare R2 (asset store)  
**Access:** gated (single admin username/password)

---

## Immutable reference

This phase plan assumes and depends on the immutable LDA design doc:

- `docs/01 - LDA Design Document (IMMUTABLE).md`

If a task conflicts with the design doc, update this plan (new version) or update the design doc (new version). Do not silently diverge.

---

## Global development rules (apply to every phase)

### Working modes

**Repo Mode (AntiGravity / Local)**
- Used for: rapid iteration, refactors, unit tests, small feature spikes
- Must run against:
  - Neon Postgres (preferred even in dev)
  - Cloudflare R2 (preferred even in dev)
- Goal: minimize “works locally only” drift.

**Render Mode (Primary)**
- Used for: end-to-end verification, long-running jobs, real provider polling, real R2 signed URLs
- Rule: each phase must have a Render-verifiable smoke test.

### Versioning rules (x.y.z)

We use 3-level version indicator in prompts:
- `x` = Phase number
- `y` = Feature prompt number within the phase
- `z` = Fix prompt iteration number for that feature (optional; starts at 1)

**Prompt ID format:** `LDA.<x>.<y>.<z>`  
Examples:
- `LDA.2.3.0` = Phase 2, feature 3, initial
- `LDA.2.3.2` = Phase 2, feature 3, fix #2

### Notes discipline (required)
Each prompt/run in AntiGravity must leave a short note block covering:
- Goal
- Files changed
- How to verify in Repo Mode
- How to verify in Render Mode
- Known mismatches / limitations
- Next prompt suggestion (if any)

---

## Phase plan overview (hybrid structure)

**Phases 1–7: Platform + integrations + pages + robustness**  
**Phases 8+: Flow-stage implementation + tuning**  
(Flow stages exist as *objects* early—stage keys, schemas, template slots, UI tabs—but their real prompt logic is intentionally deferred.)

---

# Phase 0 — Bootstrap + Render baseline + DX guardrails (0.y.z)

**Goal:** Create the repo structure and get Render deploying immediately (even if the app is mostly empty).  
**Definition of done:** A commit triggers Render deployments successfully for web/api/worker, and API health endpoints are reachable.

### 0.1 Monorepo skeleton + tooling
Deliverables:
- `/web`, `/api`, `/worker`, `/shared`
- pnpm workspace (or npm) + TS configs
- CI basic lint/typecheck
- `.env.example` (no secrets)

### 0.2 Render services created + deploy working
Deliverables:
- Render build/start commands for each service
- API `/health` and worker boot logs
- Web placeholder page calling `/health`

### 0.3 Developer runbook v0
Deliverables:
- minimal README:
  - how to run locally
  - required env vars
  - how to deploy to Render

---

# Phase 1 — Persistence + Auth + Secrets vault (1.y.z)

**Goal:** Establish Neon + encrypted secrets + gated access early (before any provider work).  
**Definition of done:** You can log in, set secrets in Admin page, and they are stored encrypted in Neon.

### 1.1 Neon migrations runner + full schema applied
Deliverables:
- migrations system
- apply schema from design doc (all tables + enums)

### 1.2 Admin auth gate (sessions)
Deliverables:
- `/auth/login`, `/auth/logout`, `/auth/me`
- session cookie middleware
- all API routes gated except login

### 1.3 Encrypted secrets vault (DB-backed)
Deliverables:
- `secrets` table wired
- AES-256-GCM encryption + `SECRETS_MASTER_KEY`
- API endpoints:
  - list keys (masked)
  - set/update secret
- Hard rule: secrets never logged

### 1.4 Admin page UI (minimal)
Deliverables:
- login UI
- admin UI to set/view masked secrets

---

# Phase 2 — Core platform contracts: flows, stages, runs, artifacts (2.y.z)

**Goal:** Build the “pipeline platform” without implementing the LDA flow itself yet.  
**Definition of done:** You can create FlowVersions + StageTemplates, create a Run, worker executes stub stages, writes artifacts to R2, and UI shows stage-by-stage progress.

### 2.1 FlowVersion + StageTemplate CRUD (API + DB)
Deliverables:
- create/clone/publish flow versions
- stage template CRUD:
  - provider kind/id/model
  - prompt template
  - attachments policy
  - input bindings
  - output schema storage
  - breakpoint flags

### 2.2 Stage execution framework (worker) with STUB adapters
Deliverables:
- worker can execute:
  - `kind=code` stub stage (writes deterministic JSON)
  - `kind=llm/image/model3d` stub stage (fake output)
- stage_runs created/updated correctly
- run_events emitted

### 2.3 Context model + template resolver (Handlebars)
Deliverables:
- build `context_json` incrementally from stage outputs
- `resolved_prompt` + `resolved_vars_json` snapshots stored

### 2.4 Artifact registry + R2 upload + signed URL generation
Deliverables:
- upload any produced file to R2
- register `assets` + `asset_files`
- signed GET URL endpoint

### 2.5 Run lifecycle endpoints
Deliverables:
- create run (select flow version, express/custom)
- view run
- view stage runs
- view run events stream/poll

---

# Phase 3 — Provider integration layer (complete before flow logic) (3.y.z)

**Goal:** Implement provider adapters and “test buttons” BEFORE wiring them into the real LDA stages.  
**Definition of done:** Admin page can “Test provider” calls; worker can call each provider in isolation and store outputs to R2.

### 3.1 OpenAI adapter (LLM)
Deliverables:
- minimal text generation wrapper
- JSON-only enforcement hooks (schema validation later)

### 3.2 Gemini adapter (LLM + image if applicable)
Deliverables:
- Gemini text wrapper
- Gemini image wrapper (if used directly)

### 3.3 Fal adapter (LLM + image)
Deliverables:
- Fal text wrapper for selected models
- Fal image wrapper (nano-banana family)

### 3.4 Meshy adapter (3D)
Deliverables:
- submit, poll, download model
- store source file in R2

### 3.5 Rodin adapter (3D)
Deliverables:
- submit, poll, download model
- store source file in R2

### 3.6 Provider test endpoints + Admin UI test buttons
Deliverables:
- API endpoints to perform minimal sanity calls
- Admin UI “Test” actions and display results

---

# Phase 4 — Asset pipeline capabilities: dedup, normalization, metadata (4.y.z)

**Goal:** Implement everything needed to turn provider outputs into consistent runtime assets, independent of LDA stage logic.  
**Definition of done:** Given any model file, system can normalize to runtime.glb, compute metadata, store in R2, and reuse via dedup keys.

### 4.1 Asset dedup keying + reuse lookup
Deliverables:
- compute `asset_key_hash`
- reuse existing asset files if present
- record provenance metadata

### 4.2 Model conversion + normalization pipeline (FBX/GLB → runtime GLB)
Deliverables:
- FBX → GLB conversion
- pivot normalization
- scale rules engine:
  - tiles: enforce 2m × 2m footprint
  - props/boss: scale to requested dimensions
- bounds + tri-count extraction stored in DB

### 4.3 Geometry ref assets bootstrapping (static uploads)
Deliverables:
- upload `static/geometry_refs/*.png` to R2
- accessible via signed URL
- referenced by templates later

### 4.4 Collision strategy v0 (platform-level)
Deliverables:
- agreed approach for web collisions:
  - simple per-mesh collider OR primitive colliders per instance
- store collision metadata decisions per asset

---

# Phase 5 — Web platform shell with stage navigation (no LDA logic yet) (5.y.z)

**Goal:** Implement the UI layout and stage navigability across Design/Run/Library before real flow stages are wired.  
**Definition of done:** You can navigate a FlowVersion’s stage list, inspect stage templates, view Run stage outputs/artifacts, and reroll/approve works against stub stages.

### 5.1 Web routing + gated layout
Deliverables:
- Login page
- App shell behind auth
- Tabs/pages: Design / Run / Library / Admin

### 5.2 Design page — FlowVersion and Stage tabs (UI-first)
Deliverables:
- select flow version
- stage list as left nav
- stage detail view (tab/sub-page):
  - prompt template editor
  - provider selection
  - config JSON editor
  - schema viewer/editor
  - breakpoint toggles

### 5.3 Run page — Stage timeline + stage detail tabs
Deliverables:
- create run (choose flow version, mode)
- stage list with statuses
- per-stage detail tab:
  - resolved prompt
  - image inputs
  - output JSON
  - produced artifacts with download links (signed URLs)
  - run event log stream/poll

### 5.4 Library page — Runs list + stage inspection
Deliverables:
- list runs
- open run viewer (stage tabs)
- download manifest/artifacts (even if stub)

---

# Phase 6 — Custom mode controls + “prompt IDE” behaviors (6.y.z)

**Goal:** Make runs fully editable in Custom mode and make stage templates testable.  
**Definition of done:** You can run in Custom mode with breakpoints, approve stages, reroll stages with notes, and test stage templates with scratch inputs.

### 6.1 Custom mode breakpoints + approve/reroll semantics
Deliverables:
- worker pauses after breakpoint stages
- approve endpoint resumes
- reroll endpoint:
  - increments attempt
  - invalidates downstream stage_runs → `stale`
  - preserves upstream artifacts

### 6.2 User notes + per-stage overrides
Deliverables:
- store `user_notes` per stage run
- incorporate notes into resolved prompt (controlled injection point)

### 6.3 Stage test harness (Design page)
Deliverables:
- API endpoint: test stage with scratch vars + scratch images
- UI: “Run test” and show resolved prompt + outputs/artifacts

### 6.4 “Flow versioning” UX
Deliverables:
- clone flow version
- publish pointer
- runs bind to a specific published version snapshot

---

# Phase 7 — Robustness, observability, and cost controls (7.y.z)

**Goal:** Stabilize platform so that implementing the real LDA flow is not blocked by infrastructure issues.  
**Definition of done:** Long-running stages are reliable; failures are inspectable; concurrency/rate limits exist; artifacts are consistently stored.

### 7.1 Schema validation + JSON repair mechanism (platform feature)
Deliverables:
- JSON schema validation system for LLM stage outputs
- generic repair prompt runner
- failure surfaces in UI

### 7.2 Concurrency + retries + provider fallback framework
Deliverables:
- per-provider concurrency limits
- exponential backoff
- retry policies per stage kind
- fallback rules supported by templates/config

### 7.3 Run cancellation and safe stopping
Deliverables:
- cancel endpoint
- worker respects cancel state

### 7.4 Logging + redaction rules
Deliverables:
- structured logs
- never print secrets
- store only safe debug artifacts to R2 if needed

---

# Phase 8 — LDA Flow Stage implementation (start ONLY after Phase 7) (8.y.z)

**Goal:** Implement the actual LDA generation flow (S1..S15) using the already-built platform capabilities.  
**Definition of done:** Default FlowVersion produces a real run end-to-end: exterior + enter → boss room with tiles/props/boss.

### 8.1 Seed default LDA FlowVersion with real stage templates
Deliverables:
- stage keys created for the LDA pipeline
- default templates inserted (editable in Design)

### 8.2 Implement stage chain with real providers (S1–S6)
Deliverables:
- prompt enhance
- layout plan
- anchor prompts
- grid image
- placement plan (multimodal)
- exterior + interior style images

### 8.3 Implement images to 3D + normalization (S7–S14)
Deliverables:
- tile/prop/boss images
- tile/prop/boss/exterior 3D generation
- normalization outputs runtime.glb for all assets

### 8.4 Manifest build (S15) + store to R2 + Library replay
Deliverables:
- manifest.json conforms to design doc
- Library can re-open any run and load manifest/artifacts

---

# Phase 9 — Viewer integration (Three.js) + stage-aware previews (9.y.z)

**Goal:** Convert platform outputs into a usable interactive demo with stage-level previews everywhere.  
**Definition of done:** Each stage tab shows appropriate preview media; final viewer works reliably.

### 9.1 Exterior viewer + Enter transition
Deliverables:
- exterior GLB inspection view
- Enter button loads interior

### 9.2 Interior FPS viewer + collisions
Deliverables:
- instantiate tiles/props/boss from manifest
- pointer lock WASD
- basic collisions

### 9.3 Stage-specific preview panels (Design/Run/Library)
Deliverables:
- grid image preview panel
- anchor image preview panel
- tile image contact sheet panel
- model preview panel (GLB viewer)
- manifest inspector panel

---

# Phase 10 — Quality iteration + demo capture readiness (10.y.z)

**Goal:** Improve reliability and visual coherence for video capture and open-source release.  
**Definition of done:** You can produce multiple good runs in a row without manual fixes.

### 10.1 Tile vocabulary tuning + niche/separator strategies
Deliverables:
- stable tile set behavior
- fewer geometry failures

### 10.2 Decor quality improvements
Deliverables:
- better stacking logic
- better wall/ceiling prop placement

### 10.3 Performance improvements (optional)
Deliverables:
- mesh compression
- optional decimation rules for very heavy assets

### 10.4 Open-source packaging
Deliverables:
- setup docs
- no secrets in repo
- clear provider setup instructions
- reproducible run workflow

---

## Phase exit criteria (summary)

- **Exit Phase 0:** Render deploys, health checks work.
- **Exit Phase 1:** Auth gate + encrypted secrets stored in Neon.
- **Exit Phase 2:** Flow/run/stage/artifact platform works end-to-end with stubs.
- **Exit Phase 3:** All providers callable + testable, outputs stored in R2.
- **Exit Phase 4:** Dedup + normalization produce runtime.glb reliably.
- **Exit Phase 5:** Design/Run/Library/Admin pages exist with stage tabs.
- **Exit Phase 6:** Custom mode approvals/rerolls + stage test harness.
- **Exit Phase 7:** Validation/repair + concurrency/fallback + cancellation hardened.
- **Exit Phase 8:** Real LDA pipeline end-to-end outputs.
- **Exit Phase 9:** Web viewer works; stage previews everywhere.
- **Exit Phase 10:** Demo-quality stability + open-source readiness.

---
END OF OVERALL PHASE PLAN (v0.1)
