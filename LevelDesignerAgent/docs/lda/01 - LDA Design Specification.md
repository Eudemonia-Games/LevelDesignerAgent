# Level Design Agent (LDA)
## Design Specification v0.1 (IMMUTABLE)

**Date:** 2026-02-05  
**Status:** Draft (but treated as the source of truth)  
**Scope:** LDA prototype only (single boss room + exterior shell + decor + boss mesh)  
**Target runtime:** Web (Three.js)  
**Deployment:** Render + Neon Postgres + Cloudflare R2  
**Repo policy:** Open source repo MUST contain **zero** API keys or secrets. All secrets are entered via Admin UI or environment variables.

---

## 0. Immutable references

This repository MUST include and treat as immutable:

- `docs/01 - LDA Design Document (IMMUTABLE).md` (this file)

If implementation deviates from this design doc, the implementation is wrong unless this doc is updated and versioned.

---

## 1. Executive summary

LDA is an internal (gated) web-based system that takes a single natural-language prompt and produces a playable “boss room” level:

- A **high-poly exterior building mesh** (single unrigged, non-animated 3D mesh) that can be inspected in a viewer.
- A **single interior boss room** assembled procedurally using generated tiles and props.
- A **high-poly boss mesh** (unrigged, non-animated) placed inside the room.
- A web **FPS exploration mode** (WASD + mouse) to walk inside and view the generated scene.

LDA is **AI-native**:
- All generation decisions live in **text + JSON** (schemas enforced).
- Generation is driven by a **versioned prompt pipeline (“FlowVersion”)** editable from the web UI.
- Runs support **Express mode** (one-click end-to-end) and **Custom mode** (stage-by-stage approval + rerolls + notes).
- All outputs are uploaded to **Cloudflare R2**, and every run/state/artifact is recorded in **Neon Postgres** for replay, reuse, and auditing.

---

## 2. Goals and non-goals

### 2.1 Goals (v0)
- Build a full working pipeline:
  - prompt → enhanced prompt → layout plan → placement plan → anchor images → tile/prop/boss images → 3D generation → normalization → manifest → web viewer.
- Support **two 3D providers**:
  - Meshy
  - Hyper3D Rodin
- Support **three LLM routes**:
  - Direct OpenAI
  - Direct Gemini
  - Fal (LLM + image models)
- Support **image generation** with:
  - “Nano Banana” family via Fal and/or Gemini image models (configurable in flow templates).
- Single boss room only:
  - grid-based
  - 1 doorway
  - optional windows
  - wall separators optional
  - pillars supported at **corners** and **cell centers** (no corner wall tiles)
- Decor system:
  - wall-hang
  - ceiling-hang
  - ground surface supports
  - ground non-surface
  - on-surface stacking with explicit references
- Web UI with:
  - Login gate
  - Design page (edit pipeline templates + flow versions)
  - Run page (express/custom)
  - Library page (browse, replay, download manifests/assets)
  - Admin page (enter/manage secrets)
- Dedup/reuse:
  - generated tiles/props/boss/exterior can be reused long-term
  - no deletion policy for v0

### 2.2 Non-goals (v0)
- Multiple rooms, corridors, navmesh, combat logic, AI enemies
- Runtime mesh boolean operations
- Full procedural gameplay progression
- Public multi-tenant access
- Fine-grained permission roles (single admin gate only)
- Automated cleanup/TTL
- Production-hard reliability features (distributed queues, guaranteed delivery, multi-worker scaling)
- Advanced light baking / GI baking (we use real-time lights in web)

---

## 3. System overview

### 3.1 Runtime views
- **Exterior Viewer:** orbit controls, inspect exterior GLB.
- **Enter button:** loads the interior run manifest and switches to FPS.
- **Interior Viewer:** FPS pointer-lock with collisions; boss room assembled from tile instances + props + boss mesh.

### 3.2 Core objects
- **FlowVersion:** a versioned pipeline definition (stage order + templates + provider configs).
- **Run:** one execution of a FlowVersion with a user prompt and outputs.
- **StageRun:** one stage execution attempt within a Run (supports rerolls).
- **Asset:** a deduplicated logical asset (tile variant, prop, boss, anchor image, etc.)
- **AssetFile:** a physical file stored in R2 (PNG, GLB, FBX, JSON, etc.)

---

## 4. Architecture

### 4.1 Deployment (Render)
Three services, same repo (monorepo), separate entrypoints:

1) `lda-web`  
- Vite + React + TypeScript  
- Renders UI + Three.js viewer  
- Calls `lda-api` via HTTPS

2) `lda-api`  
- Node.js + TypeScript (Fastify recommended)  
- Handles:
  - auth sessions
  - CRUD for flow versions + stage templates
  - CRUD for runs (create run, approve stage, reroll stage)
  - run/library listing
  - secret management
  - R2 signed URL generation
  - serves run manifests and metadata

3) `lda-worker`  
- Node.js + TypeScript (same codebase + shared packages)  
- Polls Neon for queued work
- Executes pipeline stages (LLM/image/3D + normalization + R2 upload)
- Writes StageRun outputs + Run progress to Neon

### 4.2 Storage
- **Neon Postgres**: system of record for:
  - flows, templates, runs, stage runs, job state
  - dedup asset index + metadata
  - secrets (encrypted)
- **Cloudflare R2**: file storage for:
  - all images, all 3D models, manifests, geometry reference images (static), debug artifacts

### 4.3 No secrets in repo
- Repo contains only code and `.env.example`.
- Real secrets are entered in Admin page and stored encrypted in Neon.

---

## 5. Security model

### 5.1 Gate: single admin username/password
- Entire web UI is gated.
- Auth model:
  - `POST /auth/login` with username/password
  - creates a server session row in DB
  - sets `lda_session` cookie (httpOnly, secure, SameSite=Lax)

### 5.2 Secrets storage
Secrets are stored encrypted in Neon:
- Encryption: AES-256-GCM
- Master key: `SECRETS_MASTER_KEY` env var (base64-encoded 32 bytes)
- Secrets are never logged.
- Admin UI displays secrets masked.

### 5.3 Internal service trust
- Worker and API both have `DATABASE_URL`.
- Worker reads jobs and writes results directly to DB.
- Worker decrypts secrets using the same `SECRETS_MASTER_KEY` (simplest for v0).
  - Optional alternative: worker requests decrypted secrets from API using a service token (not required in v0).

### 5.4 R2 access
- R2 bucket is private.
- Web never receives raw R2 credentials.
- API generates **signed GET URLs** for asset downloads.

---

## 6. Tech stack and repo structure

### 6.1 Languages
- TypeScript everywhere

### 6.2 Web
- React + Vite
- Three.js via `@react-three/fiber` + `@react-three/drei`
- Physics/collision: `@dimforge/rapier3d-compat`
- Pointer-lock FPS controller (custom component)

### 6.3 API and Worker
- Fastify + TypeScript (API)
- Zod for request validation + JSON schema validation for stage outputs
- Postgres: `pg` (node-postgres) OR `postgres` library
- R2: AWS SDK v3 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- HTTP client: `undici`
- Concurrency: `p-limit`

### 6.4 3D normalization tools (worker)
We MUST be able to normalize provider outputs to web-runtime GLB.

Preferred toolchain:
- `fbx2gltf` binary (for FBX → GLB)
- `@gltf-transform/core` + `@gltf-transform/functions` for transforms, compression, metadata

Notes:
- Providers may return GLB or FBX. We store source format as-is and always produce `runtime.glb`.

---

## 7. Data model (Neon Postgres)

### 7.1 Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

DO $$ BEGIN
  CREATE TYPE run_mode AS ENUM ('express', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE run_status AS ENUM ('queued', 'running', 'waiting_user', 'succeeded', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stage_status AS ENUM ('pending', 'running', 'waiting_user', 'succeeded', 'failed', 'skipped', 'stale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provider_kind AS ENUM ('llm', 'image', 'model3d', 'code');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provider_id AS ENUM ('openai', 'gemini', 'fal', 'meshy', 'rodin', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE asset_kind AS ENUM (
    'prompt_text',
    'spec_json',
    'grid_image',
    'anchor_exterior_image',
    'anchor_interior_image',
    'tile_image',
    'prop_image',
    'boss_image',
    'exterior_model_source',
    'exterior_model_runtime',
    'tile_model_source',
    'tile_model_runtime',
    'prop_model_source',
    'prop_model_runtime',
    'boss_model_source',
    'boss_model_runtime',
    'collision_mesh',
    'manifest_json',
    'debug_log'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tile_role AS ENUM (
    'floor',
    'wall',
    'roof',
    'doorway',
    'window',
    'pillar',
    'wall_separator',
    'wall_niche'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prop_category AS ENUM (
    'ground_non_surface',
    'ground_surface',
    'on_surface',
    'wall_hang',
    'ceiling_hang'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

7.3 Tables
7.3.1 auth_sessions

Stores login sessions for the single admin gate.

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash TEXT NOT NULL UNIQUE, -- SHA256(token)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);

7.3.2 secrets

Encrypted secrets stored in Neon.

CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY, -- e.g. "OPENAI_API_KEY"
  algo TEXT NOT NULL DEFAULT 'AES-256-GCM',
  ciphertext_base64 TEXT NOT NULL,
  nonce_base64 TEXT NOT NULL,
  tag_base64 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

7.3.3 flow_versions

A pipeline version.

CREATE TABLE IF NOT EXISTS flow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "bossroom_default"
  version_major INT NOT NULL DEFAULT 0,
  version_minor INT NOT NULL DEFAULT 1,
  version_patch INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS flow_versions_name_version_uq
ON flow_versions (name, version_major, version_minor, version_patch);

7.3.4 flow_stage_templates

Defines each stage’s provider, model, and prompt template (editable in Design page).

CREATE TABLE IF NOT EXISTS flow_stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_version_id UUID NOT NULL REFERENCES flow_versions(id) ON DELETE CASCADE,

  stage_key TEXT NOT NULL,          -- stable identifier: "S1_PROMPT_ENHANCE"
  order_index INT NOT NULL,         -- stage execution order
  kind provider_kind NOT NULL,
  provider provider_id NOT NULL,
  model_id TEXT NOT NULL DEFAULT '',

  -- Prompt template: Handlebars syntax with helpers.
  prompt_template TEXT NOT NULL DEFAULT '',

  -- For stages that accept image inputs:
  attachments_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Input variable binding map:
  -- { "varName": "$.context.some.path" }
  input_bindings_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Provider-specific params:
  -- e.g. temperature/top_p, image aspect ratio, meshy lowpoly flags, etc.
  provider_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- JSON schema for output validation (for LLM/code stages)
  output_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Whether to pause after this stage in Custom mode
  breakpoint_after BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(flow_version_id, stage_key),
  UNIQUE(flow_version_id, order_index)
);

7.3.5 runs

One pipeline run (aka job).

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_version_id UUID NOT NULL REFERENCES flow_versions(id),

  mode run_mode NOT NULL DEFAULT 'express',
  status run_status NOT NULL DEFAULT 'queued',

  user_prompt TEXT NOT NULL,
  seed INT NOT NULL DEFAULT 0,

  -- The orchestrator accumulates a JSON context as stages complete.
  -- This is the "global context object" for the run.
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  current_stage_key TEXT NULL,
  waiting_for_stage_key TEXT NULL,
  waiting_reason TEXT NULL,

  error_summary TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runs_status_idx ON runs (status);
CREATE INDEX IF NOT EXISTS runs_created_at_idx ON runs (created_at DESC);

7.3.6 stage_runs

Each stage attempt for a run (supports reroll by incrementing attempt).

CREATE TABLE IF NOT EXISTS stage_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

  stage_key TEXT NOT NULL,
  attempt INT NOT NULL DEFAULT 1,

  status stage_status NOT NULL DEFAULT 'pending',
  user_notes TEXT NOT NULL DEFAULT '',

  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,

  -- The fully resolved prompt (after template + vars)
  resolved_prompt TEXT NOT NULL DEFAULT '',

  -- Variable snapshot used during resolution
  resolved_vars_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Image inputs used (R2 keys or asset_file ids)
  resolved_image_inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Output JSON (for LLM/code stages)
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Artifact references produced by this stage
  -- Example: [{"asset_file_id": "...", "kind": "tile_image"}]
  produced_artifacts_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  error_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE(run_id, stage_key, attempt)
);

CREATE INDEX IF NOT EXISTS stage_runs_run_stage_idx ON stage_runs (run_id, stage_key);

7.3.7 run_events

Progress messages.

CREATE TABLE IF NOT EXISTS run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  stage_key TEXT NULL,
  level TEXT NOT NULL DEFAULT 'info', -- 'info'|'warn'|'error'
  message TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_events_run_created_idx ON run_events (run_id, created_at ASC);

7.3.8 assets

Deduplicated logical asset.

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dedup key, computed by worker. Must be stable for reuse.
  asset_key_hash TEXT NOT NULL UNIQUE,

  kind asset_kind NOT NULL,

  -- Optional semantics:
  tile_role tile_role NULL,
  prop_category prop_category NULL,
  slug TEXT NOT NULL DEFAULT '',          -- e.g. "tile_wall_A", "prop_brazier_01", "boss_01"

  provider provider_id NOT NULL DEFAULT 'internal',
  model_id TEXT NOT NULL DEFAULT '',
  prompt_text TEXT NOT NULL DEFAULT '',
  prompt_hash TEXT NOT NULL DEFAULT '',   -- sha256(prompt_text) or empty
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_kind_idx ON assets (kind);
CREATE INDEX IF NOT EXISTS assets_slug_idx ON assets (slug);

7.3.9 asset_files

Physical files in R2.

CREATE TABLE IF NOT EXISTS asset_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  file_kind asset_kind NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  bytes_size BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',

  -- For images:
  width_px INT NULL,
  height_px INT NULL,

  -- For models:
  tri_count INT NULL,
  bounds_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- {min:[x,y,z], max:[x,y,z]}

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_files_asset_idx ON asset_files (asset_id);

7.3.10 run_asset_links

Which assets were used by a run (for Library).

CREATE TABLE IF NOT EXISTS run_asset_links (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  usage_stage_key TEXT NOT NULL,
  usage_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, asset_id, usage_stage_key)
);

CREATE INDEX IF NOT EXISTS run_asset_links_run_idx ON run_asset_links (run_id);

8. Secrets list (Admin page)

All secrets below are stored in secrets table encrypted.

8.1 AI provider secrets

OPENAI_API_KEY

GEMINI_API_KEY

FAL_API_KEY

MESHY_API_KEY

RODIN_API_KEY (Hyper3D Rodin)

8.2 Cloudflare R2 secrets

CF_R2_ACCOUNT_ID

CF_R2_ACCESS_KEY_ID

CF_R2_SECRET_ACCESS_KEY

CF_R2_BUCKET_NAME

CF_R2_ENDPOINT (optional; default derived from account)

CF_R2_PUBLIC_BASE_URL (optional; for debug; normally we use signed URLs)

8.3 Render (optional)

We do NOT require Render secrets for the core pipeline, but Admin supports storing:

RENDER_DEPLOY_HOOK_URL (optional)

RENDER_API_KEY (optional)

8.4 Environment variables required (not stored in DB)

DATABASE_URL (Neon)

SECRETS_MASTER_KEY (base64 32 bytes)

ADMIN_USERNAME

ADMIN_PASSWORD_HASH (bcrypt/argon2 hash)

SESSION_COOKIE_SECRET (for signing session tokens)

API_BASE_URL (web -> api)

R2_SIGNED_URL_TTL_SECONDS (default 3600)

9. Cloudflare R2 object layout

Bucket: CF_R2_BUCKET_NAME

9.1 Key patterns

We use dedup keys per asset:

Static geometry references (checked into repo; uploaded at install):

static/geometry_refs/{tile_role}.png

static/geometry_refs/floor.png

static/geometry_refs/wall.png

static/geometry_refs/roof.png

static/geometry_refs/doorway.png

static/geometry_refs/window.png

static/geometry_refs/pillar.png

static/geometry_refs/wall_separator.png

static/geometry_refs/wall_niche.png

Asset storage:

assets/{asset_key_hash}/preview.png

assets/{asset_key_hash}/source.fbx (if provider returns fbx)

assets/{asset_key_hash}/source.glb (if provider returns glb)

assets/{asset_key_hash}/runtime.glb (normalized for web)

assets/{asset_key_hash}/debug.json (optional)

Run manifests:

runs/{run_id}/manifest.json

runs/{run_id}/grid.png (if we store run-specific grid)

We do not delete keys in v0.

10. HTTP API (lda-api)

All endpoints require auth except /auth/login.

10.1 Auth

POST /auth/login

body: { "username": "...", "password": "..." }

success: sets cookie lda_session

POST /auth/logout

GET /auth/me

10.2 Admin (secrets)

GET /admin/secrets (returns keys + masked values + updated_at)

PUT /admin/secrets/:key

body: { "value": "..." }

POST /admin/test/provider/:provider_id

tests provider key exists + minimal API call

POST /admin/test/r2

POST /admin/test/db

10.3 Design (flow versions)

GET /design/flows

POST /design/flows

body: { name, version_major, version_minor, version_patch, description }

POST /design/flows/:id/clone

PUT /design/flows/:id

POST /design/flows/:id/publish

10.4 Design (stage templates)

GET /design/flows/:flowId/stages

PUT /design/flows/:flowId/stages/:stageKey

edits prompt template, provider, model_id, config, breakpoint flags

POST /design/flows/:flowId/stages/:stageKey/test

body: { "scratch_vars": {...}, "scratch_image_asset_file_ids": [...] }

returns: resolved prompt + output

10.5 Runs

POST /runs

body: { "flow_version_id": "...", "mode": "express|custom", "user_prompt": "...", "seed": 0 }

GET /runs

GET /runs/:runId

GET /runs/:runId/events

GET /runs/:runId/stages

POST /runs/:runId/approve

body: { "stage_key": "..." }

POST /runs/:runId/reroll

body: { "stage_key": "...", "user_notes": "..." }

10.6 Assets

GET /assets/:assetId

GET /assets/:assetId/files

GET /asset-files/:assetFileId/signed-url

returns signed GET url

GET /runs/:runId/manifest

returns manifest JSON (also stored in R2)

11. Worker orchestration
11.1 Job claiming loop

Worker polls:

find runs with status='queued' or status='running' but with missing stage (recovery)

claim with SELECT ... FOR UPDATE SKIP LOCKED pattern

Pseudo:

start tx

select one run where status in ('queued','running') order by created_at

update run status to 'running', set current_stage_key

commit

execute next stage(s)

11.2 Stage execution rules

Each stage is executed in order_index order.

If run mode is custom, and stage template has breakpoint_after=true, worker will:

mark stage succeeded

set run status to waiting_user

set waiting_for_stage_key to that stage

stop execution

11.3 Reroll rules

When rerolling stage X:

increment attempt for stage X

mark all downstream stage_runs as stale

optionally remove downstream artifacts from run context (but not from R2)

set run status to queued

12. Geometry + coordinate system
12.1 Tile unit system

Tile footprint: 2m x 2m in world units.

Y-up.

Room is a grid of cells (x,z):

x: 0..W-1

z: 0..H-1

World origin is room center:

world_x = (x - (W/2) + 0.5) * 2.0

world_z = (z - (H/2) + 0.5) * 2.0

world_y = 0 is floor plane.

12.2 Walls

Walls are placed on grid edges.

Edge representation:

Vertical edges: between (x,z) and (x,z+1) with orientation E/W depending on side.

Horizontal edges: between (x,z) and (x+1,z) with orientation N/S.

For v0 simplicity: room boundary only.

All boundary edges get a wall segment, except where doorway/window is.

12.3 Pillars (no corner walls)

We do NOT generate corner wall tiles.

Pillars can be placed:

At corners (grid vertices):

corner (cx, cz) where cx: 0..W, cz: 0..H

At cell centers:

cell (x,z)

Pillars are used to:

visually reinforce corners

hide wall seams

add boss-room drama

12.4 Tile roles (Dungeon Architect–style)

Supported tile roles:

Floor

Wall

Roof/Ceiling

Doorway

Window

Pillar

Wall separator (optional)

Wall niche (optional) — a wall segment with a niche for decor

No corner wall tiles.

13. Prop taxonomy and placement
13.1 Categories

GROUND_NON_SURFACE: sits on floor, does not support stacking

GROUND_SURFACE: sits on floor, supports stacking (table/altar/shelf/pedestal)

ON_SURFACE: placed on top of a specific surface instance (book, candle, skull)

WALL_HANG: attached to a wall segment at a height band

CEILING_HANG: attached to ceiling at a cell coordinate, drops down

13.2 Placement references

Floor cell ref: { "type":"cell", "x":int, "z":int }

Corner ref: { "type":"corner", "x":int, "z":int }

Wall edge ref: { "type":"edge", "x":int, "z":int, "dir":"N|S|E|W" }

13.3 Stacking

Any ON_SURFACE prop must specify:

support_instance_id referencing a GROUND_SURFACE instance.

14. Asset normalization requirements
14.1 Outputs required for every generated model

For each tile/prop/boss/exterior 3D generation we produce:

Source file (as returned by provider):

source.fbx OR source.glb

Runtime file:

runtime.glb (normalized)

Metadata:

bounds (AABB), triangle count, scale factor applied, up axis, pivot type

14.2 Tile normalization

Tiles must be scaled such that:

Floor tile: exactly 2m x 2m in XZ footprint.

Roof tile: exactly 2m x 2m.

Wall tile: exactly 2m length along X (or Z depending orientation), with thickness <= 0.3m, height per layout.

Doorway/window tile: same footprint as wall tile.

Pillar: footprint <= 1m, height per layout.

Wall separator: slender vertical trim, width <= 0.3m, height per layout.

Pivot rule:

All runtime.glb pivots are at bottom-center of the asset in local space.

14.3 Prop normalization

Props are scaled to desired_dimensions_m from LayoutPlan:

AABB longest dimension is matched to target dims (prefer matching height first for hanging props).

Surface props (GROUND_SURFACE) must have metadata:

surface_top_y (local)

surface_bounds_xz (local rectangle usable for placement)

14.4 Boss normalization

Boss mesh requirements:

Unrigged

Non-animated

High poly target (default 80k–200k triangles; configurable)

Pivot bottom-center

Scaled to desired boss height (e.g., 3m–6m) from LayoutPlan

15. The pipeline (default FlowVersion)
15.1 Global constraints (constants)

These are injected into templates as constraints:

{
  "tile_size_m": 2.0,
  "max_props": 15,
  "max_tile_variants_per_role": 3,
  "room_shape": "rectangular_grid",
  "min_room_w": 8,
  "max_room_w": 16,
  "min_room_h": 8,
  "max_room_h": 16,
  "boss_poly_target_range": [80000, 200000],
  "tile_poly_target_range": [3000, 10000],
  "prop_poly_target_range": [10000, 50000]
}

15.2 Stage list (default order)

We define these stage keys:

S1_PROMPT_ENHANCE (LLM)

S2_LAYOUT_PLAN (LLM)

S2_ANCHOR_PROMPTS (LLM)

S3_RENDER_GRID_IMAGE (CODE)

S4_PLACEMENT_PLAN (LLM multimodal with grid image)

S5_EXTERIOR_ANCHOR_IMAGE (IMAGE)

S6_INTERIOR_STYLE_IMAGE (IMAGE)

S7_TILE_IMAGES (IMAGE batch)

S8_PROP_IMAGES (IMAGE batch)

S9_BOSS_IMAGE (IMAGE)

S10_EXTERIOR_3D_MODEL (3D from exterior image)

S11_TILE_3D_MODELS (3D batch)

S12_PROP_3D_MODELS (3D batch)

S13_BOSS_3D_MODEL (3D from boss image)

S14_NORMALIZE_ALL_MODELS (CODE)

S15_BUILD_MANIFEST (CODE)

Custom mode breakpoints (default):

after S1

after S2_LAYOUT_PLAN + S2_ANCHOR_PROMPTS (treated as a group in UI)

after S4

after S6

after S15

(Implemented by setting breakpoint_after on selected stages.)

16. Prompt templates (default)

Template engine: Handlebars

Helpers available:

{{json var}} → JSON.stringify(var, null, 2)

{{upper var}}, {{lower var}}

All LLM stages MUST output strict JSON only.

16.1 Shared “JSON repair” prompt (used automatically)

If a stage output fails schema validation, we run a repair call with:

SYSTEM:
You fix invalid JSON to match a given JSON schema. Output ONLY valid JSON.

USER TEMPLATE:
Schema:

{{json output_schema}}


Invalid JSON:

{{invalid_json}}


Return a corrected JSON object that satisfies the schema exactly. Do not add extra fields. Do not include explanations.

17. Stage specifications (inputs, outputs, prompts)
17.1 Stage: S1_PROMPT_ENHANCE

Kind: LLM
Default provider/model: gemini / gemini-2.5-pro (configurable)
Purpose: expand user prompt into a stable style guide + constraints-friendly brief.

Input variables (resolved_vars_json):

user_prompt (string) ← runs.user_prompt

constraints (object) ← constants

tile_roles_supported (array<string>) = ["floor","wall","roof","doorway","window","pillar","wall_separator","wall_niche"]

prop_categories_supported (array<string>) = ["ground_non_surface","ground_surface","on_surface","wall_hang","ceiling_hang"]

Output schema (high level):

enhanced_prompt (string)

style_guide (object)

do_not_generate (array<string>)

keywords (array<string>)

Prompt template:

You are the "Level Design Agent" prompt enhancer.

We are generating ONE boss room interior (grid-based) and ONE exterior building shell, plus a static boss mesh.

User prompt:
{{user_prompt}}

Hard constraints (do not violate):
{{json constraints}}

Supported tile roles:
{{json tile_roles_supported}}

Supported prop categories:
{{json prop_categories_supported}}

Task:
1) Rewrite the prompt into an "enhanced prompt" that is precise and usable to drive consistent generation across multiple stages.
2) Produce a style guide that is concrete: architectural motifs, materials, palette, lighting, mood, prop motifs, and what to avoid.
3) Keep it grounded to a "structure" (building) outside, and a boss room inside.

Return JSON ONLY in this exact shape:
{
  "enhanced_prompt": "...",
  "style_guide": {
    "theme": "...",
    "setting": "...",
    "time_period": "...",
    "mood": "...",
    "color_palette": ["..."],
    "materials": ["..."],
    "lighting_notes": ["..."],
    "architectural_motifs": ["..."],
    "prop_motifs": ["..."],
    "camera_notes": ["..."],
    "avoid": ["..."]
  },
  "do_not_generate": ["..."],
  "keywords": ["..."]
}

17.2 Stage: S2_LAYOUT_PLAN

Kind: LLM
Default provider/model: gemini / gemini-2.5-pro
Purpose: decide room size, wall height, door/window counts, tile variants, prop list, boss spec.

Input variables:

enhanced_prompt (string) ← context.S1_PROMPT_ENHANCE.enhanced_prompt

style_guide (object) ← context.S1_PROMPT_ENHANCE.style_guide

constraints (object)

tile_roles_supported (array<string>)

prop_categories_supported (array<string>)

Output schema overview:

room object (W,H, ceiling height, wall height, thickness)

openings object (door edge, windows edges)

tile_plan array: per tile role: variant count, prompts, geometry ref role

prop_plan array: up to max props

boss_plan object: boss description + dims + poly target

notes_for_placement array (hints for next stage)

Prompt template:

You are the "Level Design Agent" layout planner.

Enhanced prompt:
{{enhanced_prompt}}

Style guide:
{{json style_guide}}

Hard constraints:
{{json constraints}}

Tile roles supported (closed set):
{{json tile_roles_supported}}

Prop categories supported (closed set):
{{json prop_categories_supported}}

We are generating ONE rectangular boss room on a 2m grid.
- No corner wall tiles allowed.
- Pillars may be placed at corners or cell centers.
- Wall separators are optional trims placed between wall segments.
- Max props: {{constraints.max_props}}

Your task:
1) Choose room width/height in CELLS (integers), within min/max bounds.
2) Choose wall height and ceiling height (meters).
3) Define 1 doorway on the boundary edges. Optionally define windows.
4) Define tile roles to generate (always include floor, wall, roof, doorway; windows/pillars/separators/niches optional).
5) For each tile role define:
   - variant_count (1-{{constraints.max_tile_variants_per_role}})
   - a text "tile_visual_prompt" describing how the tile should look (style, materials, motifs)
   - a "tile_geometry_role" that matches one of the tile roles (used to pick geometry reference image)
   - target triangle range for the tile (usually {{constraints.tile_poly_target_range}})
6) Define up to {{constraints.max_props}} props, each with:
   - prop_id (stable slug)
   - name
   - category (must be one of supported categories)
   - short visual prompt
   - desired_dimensions_m: {w,h,d} meters (reasonable for a boss room)
   - poly_target (10k-50k)
   - is_surface_support boolean (true only for GROUND_SURFACE)
   - allowed_support_ids (for ON_SURFACE props; list of surface prop_ids)
7) Define ONE boss:
   - boss_id
   - name
   - visual prompt
   - desired_dimensions_m
   - poly_target within boss range (80k-200k)

Return JSON ONLY matching this exact shape:

{
  "room": {
    "width_cells": 0,
    "height_cells": 0,
    "wall_height_m": 0.0,
    "ceiling_height_m": 0.0,
    "wall_thickness_m": 0.2
  },
  "openings": {
    "door": { "edge": { "type":"edge","x":0,"z":0,"dir":"N" } },
    "windows": [
      { "edge": { "type":"edge","x":0,"z":0,"dir":"N" } }
    ]
  },
  "tile_plan": [
    {
      "tile_role": "floor",
      "variant_count": 1,
      "tile_geometry_role": "floor",
      "tile_visual_prompt": "...",
      "tile_tri_target_range": [3000, 10000]
    }
  ],
  "prop_plan": [
    {
      "prop_id": "prop_table_01",
      "name": "Ritual Table",
      "category": "ground_surface",
      "prop_visual_prompt": "...",
      "desired_dimensions_m": { "w": 1.6, "h": 1.0, "d": 0.9 },
      "poly_target": 20000,
      "is_surface_support": true,
      "allowed_support_ids": []
    }
  ],
  "boss_plan": {
    "boss_id": "boss_01",
    "name": "...",
    "boss_visual_prompt": "...",
    "desired_dimensions_m": { "w": 2.5, "h": 4.5, "d": 2.5 },
    "poly_target": 120000
  },
  "notes_for_placement": ["..."]
}

17.3 Stage: S2_ANCHOR_PROMPTS

Kind: LLM
Default provider/model: gemini / gemini-2.5-pro
Purpose: produce prompts for exterior anchor image and interior style reference image.

Input variables:

enhanced_prompt

style_guide

layout_plan (output of S2_LAYOUT_PLAN)

Prompt template:

You are the "Level Design Agent" anchor prompt writer.

Enhanced prompt:
{{enhanced_prompt}}

Style guide:
{{json style_guide}}

Layout plan:
{{json layout_plan}}

Task:
Write TWO image-generation prompts:
1) Exterior building hero shot (single structure). Should clearly read as the dungeon entrance. No characters.
2) Interior style reference shot of the boss room atmosphere (not a top-down map). No characters.

Constraints:
- Avoid text/logos/watermarks in images.
- Use language that produces consistent architecture and materials.

Return JSON ONLY:
{
  "exterior_image_prompt": "...",
  "exterior_aspect_ratio": "16:9",
  "interior_style_image_prompt": "...",
  "interior_aspect_ratio": "16:9"
}

17.4 Stage: S3_RENDER_GRID_IMAGE

Kind: CODE (deterministic)
Purpose: create a labeled grid PNG for multimodal placement.

Inputs:

layout_plan.room.width_cells, layout_plan.room.height_cells

door edge, windows edges

Output artifacts:

grid.png uploaded to R2 as:

runs/{run_id}/grid.png

Also create an asset of kind grid_image for reuse/debug.

Grid image spec:

White background

Each cell drawn with thin gray lines

Coordinate labels:

columns: A, B, C... at top and bottom

rows: 1..N at left and right

Boundary walls drawn as thick black lines

Door edge drawn as green line segment

Windows drawn as blue line segments

Legend printed in margin:

Black = wall

Green = door

Blue = window

Cell center dots optional

17.5 Stage: S4_PLACEMENT_PLAN

Kind: LLM (multimodal)
Default provider/model: gemini / gemini-2.5-pro
Attachments: grid image runs/{run_id}/grid.png
Purpose: place pillars, props, stacking, boss placement.

Input variables:

layout_plan

style_guide

notes_for_placement

constraints

Prompt template (text portion):

You are the "Level Design Agent" placement planner.

You will receive a grid image showing the room layout with labeled coordinates.

Hard constraints:
{{json constraints}}

Layout plan:
{{json layout_plan}}

Style guide:
{{json style_guide}}

Notes from layout stage:
{{json layout_plan.notes_for_placement}}

Task:
1) Place pillars (corner and/or cell center). Use pillars to frame the boss area and hide wall seams.
2) Place props according to their categories:
   - ground_non_surface: place on floor cells
   - ground_surface: place on floor cells and use them as supports
   - on_surface: must reference an existing ground_surface instance_id
   - wall_hang: must reference a boundary edge and specify a height band (LOW/MID/HIGH)
   - ceiling_hang: must reference a cell and specify drop length class (SHORT/MED/LONG)
3) Place the boss in a strong focal position (typically opposite the doorway).
4) Provide facing direction for key props and boss (dir: N/S/E/W).
5) Do NOT block the doorway.
6) Keep it sparse enough to navigate.

Return JSON ONLY:

{
  "pillar_instances": [
    { "instance_id":"pillar_01", "placement": { "type":"corner","x":0,"z":0 } }
  ],
  "wall_separator_instances": [
    { "instance_id":"sep_01", "edge": { "type":"edge","x":0,"z":0,"dir":"N" } }
  ],
  "prop_instances": [
    {
      "instance_id": "inst_table_01",
      "prop_id": "prop_table_01",
      "category": "ground_surface",
      "placement": { "type":"cell","x":0,"z":0 },
      "facing_dir": "N",
      "height_band": null,
      "drop_length_class": null,
      "support_instance_id": null
    },
    {
      "instance_id": "inst_book_01",
      "prop_id": "prop_book_01",
      "category": "on_surface",
      "placement": { "type":"cell","x":0,"z":0 },
      "facing_dir": "E",
      "height_band": null,
      "drop_length_class": null,
      "support_instance_id": "inst_table_01"
    }
  ],
  "boss_instance": {
    "instance_id": "inst_boss_01",
    "boss_id": "boss_01",
    "placement": { "type":"cell","x":0,"z":0 },
    "facing_dir": "S"
  }
}

17.6 Stage: S5_EXTERIOR_ANCHOR_IMAGE

Kind: IMAGE
Default provider/model: fal / fal-ai/nano-banana-pro (configurable)
Inputs:

exterior_image_prompt from S2_ANCHOR_PROMPTS

Image prompt (resolved):

{{exterior_image_prompt}}

Output:

PNG (or WebP) uploaded to:

assets/{hash}/preview.png (as anchor_exterior_image)

17.7 Stage: S6_INTERIOR_STYLE_IMAGE

Kind: IMAGE
Default provider/model: fal / fal-ai/nano-banana-pro/edit OR fal-ai/nano-banana-pro
Inputs:

interior_style_image_prompt

optional reference: exterior image

Output:

interior style reference image uploaded (kind anchor_interior_image)

17.8 Stage: S7_TILE_IMAGES (batch)

Kind: IMAGE batch
Default provider/model: gemini / gemini-2.5-flash-image (configurable)
Inputs per tile role variant:

interior style image

geometry ref image for the role

tile_visual_prompt

Tile image prompt template:

Create a clean, well-lit reference image of a dungeon tile.

Tile role: {{tile_role}}
Variant: {{variant_index}}/{{variant_count}}

Style constraints:
{{json style_guide}}

Tile visual prompt:
{{tile_visual_prompt}}

Requirements:
- The tile should match the interior style reference image.
- The geometry should match the provided geometry reference image for this tile role.
- Neutral background, no text, no logos, no characters.
- Camera: slightly angled or orthographic that clearly shows shape and surface details.
- Focus on consistent materials and motifs for a cohesive tileset.

Output: one image.

17.9 Stage: S8_PROP_IMAGES (batch)

Kind: IMAGE batch
Default provider/model: gemini / gemini-2.5-flash-image (configurable)

Prop image prompt template:

Create a reference image for a single dungeon prop.

Prop name: {{prop_name}}
Prop category: {{prop_category}}
Desired size (meters): {{json desired_dimensions_m}}

Style constraints:
{{json style_guide}}

Prop visual prompt:
{{prop_visual_prompt}}

Requirements:
- Must match the interior style reference image.
- Single object, centered, neutral background, no characters, no text/logos.
- Show enough detail for 3D reconstruction.
- Avoid thin floating parts unless necessary.

Output: one image.

17.10 Stage: S9_BOSS_IMAGE

Kind: IMAGE
Default provider/model: gemini / gemini-2.5-flash-image (configurable)

Boss image prompt template:

Create a concept image of a single boss creature/statue/guardian for a dungeon boss room.

Boss name: {{boss_name}}
Desired size (meters): {{json desired_dimensions_m}}

Style constraints:
{{json style_guide}}

Boss visual prompt:
{{boss_visual_prompt}}

Requirements:
- Single subject, no other characters.
- Full body visible.
- High detail design suitable for a high poly static model.
- Neutral-ish background (not a full scene), no text/logos.

Output: one image.

17.11 Stage: S10_EXTERIOR_3D_MODEL

Kind: MODEL3D
Provider: rodin default (fallback to meshy)
Input:

exterior anchor image

text prompt (optional): exterior prompt

Output:

source model file

normalized runtime.glb (later stage)

17.12 Stage: S11_TILE_3D_MODELS (batch)

Kind: MODEL3D batch
Provider: meshy default for tiles (low poly)
Input per tile:

tile image

text prompt: tile role + visual notes

Provider config defaults for Meshy tiles:

{
  "quality_mode": "low_poly",
  "target_triangles": 7000,
  "texture_mode": "non_pbr_ok"
}

17.13 Stage: S12_PROP_3D_MODELS (batch)

Kind: MODEL3D batch
Provider: rodin default, fallback meshy
Input per prop:

prop image

prop prompt

target triangles = poly_target

17.14 Stage: S13_BOSS_3D_MODEL

Kind: MODEL3D
Provider: rodin default
Input:

boss image

boss prompt

triangles target (80k–200k)

17.15 Stage: S14_NORMALIZE_ALL_MODELS

Kind: CODE
Purpose: convert all models to runtime.glb, apply scaling rules.

Process:

Determine source format: FBX or GLB

Convert FBX→GLB if needed

Compute bounds and tri counts

Scale to desired dims:

tiles to 2m footprint

props to desired_dimensions_m

boss to desired_dimensions_m

Re-center pivot to bottom-center

Write runtime.glb to R2 and update asset_files metadata

17.16 Stage: S15_BUILD_MANIFEST

Kind: CODE
Purpose: generate final scene manifest for web.

Manifest stored:

R2 key: runs/{run_id}/manifest.json

DB asset: kind manifest_json

18. Manifest format (explicit)

manifest.json schema:

{
  "manifest_version": "0.1",
  "run_id": "uuid",
  "flow_version": { "name":"bossroom_default", "semver":"0.1.0" },

  "exterior": {
    "runtime_glb_asset_file_id": "uuid",
    "initial_camera": { "pos":[0,5,10], "target":[0,2,0] }
  },

  "interior": {
    "tile_size_m": 2.0,
    "room": {
      "width_cells": 12,
      "height_cells": 10,
      "wall_height_m": 4.0,
      "ceiling_height_m": 4.5
    },

    "tiles": [
      {
        "tile_role": "floor",
        "variant": 1,
        "runtime_glb_asset_file_id": "uuid",
        "instances": [
          { "pos":[0,0,0], "rotY":0 }
        ]
      }
    ],

    "props": [
      {
        "instance_id": "inst_table_01",
        "prop_id": "prop_table_01",
        "category": "ground_surface",
        "runtime_glb_asset_file_id": "uuid",
        "pos":[0,0,0],
        "rotY":90,
        "support_instance_id": null
      }
    ],

    "boss": {
      "instance_id": "inst_boss_01",
      "boss_id": "boss_01",
      "runtime_glb_asset_file_id": "uuid",
      "pos":[0,0,0],
      "rotY":180
    },

    "lights": {
      "ambient_intensity": 0.4,
      "directional_intensity": 1.0,
      "directional_dir": [-0.4, -1.0, -0.2]
    }
  }
}

19. Web viewer requirements
19.1 Exterior viewer

Orbit controls

Load exterior.runtime.glb

Basic lighting

19.2 Interior viewer

Pointer lock FPS

Capsule collision using Rapier:

collide with tile/prop/boss meshes using simplified colliders (from glTF or autogenerated)

Load interior assets via signed URLs

Instantiate tile instances:

floor fill

roof fill

boundary walls with door/windows

pillars and wall separators from placement plan

Place props:

for on-surface props, offset them atop support surface bounds

19.3 “Design / Run / Library / Admin”

Design: edit FlowVersion templates and publish

Run: execute flow, express/custom

Library: list runs, open viewer, download manifest

20. Seed data: default flow + stage templates

This section defines the initial rows inserted into Neon.

NOTE: Prompt templates below must match exactly what we want to start with, but are editable in UI.

20.1 Create default flow version
INSERT INTO flow_versions (name, version_major, version_minor, version_patch, description, is_published)
VALUES ('bossroom_default', 0, 1, 0, 'Default boss room pipeline (v0.1)', true);

20.2 Insert stage templates

(Implementation detail: You will fetch the created flow_version_id and insert stage templates accordingly.)

For each stage, insert:

stage_key

order_index

kind, provider, model_id

prompt_template

input_bindings_json

attachments_policy_json

provider_config_json

output_schema_json

breakpoint_after

(Exact SQL insertion is omitted here because it requires embedding long prompt_template strings;
the API should seed these templates programmatically on first run.)

21. Explicit variable dictionary (what templates can reference)

All stage templates may reference:

21.1 Run-level variables

user_prompt (string)

seed (int)

constraints (object)

21.2 Context variables (written as stages succeed)

Stored in runs.context_json under:

context.S1_PROMPT_ENHANCE

context.S2_LAYOUT_PLAN

context.S2_ANCHOR_PROMPTS

context.S3_RENDER_GRID_IMAGE

context.S4_PLACEMENT_PLAN

context.S5_EXTERIOR_ANCHOR_IMAGE

context.S6_INTERIOR_STYLE_IMAGE

...

Each is the validated output_json for that stage plus artifact refs.

21.3 Asset references

asset_file_id for any produced file

r2_key for any produced file

22. Validation and correctness checks
22.1 JSON schema validation (mandatory)

All LLM stage outputs must validate:

if invalid: run repair prompt once

if still invalid: mark stage failed

22.2 Placement validation (code)

Before manifest build:

Ensure doorway edge is not blocked by a prop instance in adjacent cells

Ensure ON_SURFACE props reference existing support instance

Ensure all coordinates in bounds

If invalid: fail stage or request placement repair

22.3 Asset validation (code)

After normalization:

runtime.glb loads

triangle counts within targets (warn if out)

bounding boxes sane (non-zero)

23. Boss mesh addition (explicit)

The boss is produced as:

boss_plan in S2_LAYOUT_PLAN

S9_BOSS_IMAGE generates a concept image

S13_BOSS_3D_MODEL generates a static high poly mesh

S14_NORMALIZE_ALL_MODELS scales boss and produces runtime.glb

S4_PLACEMENT_PLAN chooses boss placement

S15_BUILD_MANIFEST includes the boss instance

Boss constraints:

unrigged

non-animated

single mesh asset (can contain multiple submeshes/materials, but one GLB file)

positioned for showcase in the boss room

24. Open-source run instructions (high level)

Deploy Neon + create DB.

Deploy Cloudflare R2 bucket.

Set env vars on Render services:

DATABASE_URL

SECRETS_MASTER_KEY

ADMIN_USERNAME

ADMIN_PASSWORD_HASH

SESSION_COOKIE_SECRET

Open app → login → Admin page → enter provider keys + R2 credentials

Design page → publish flow version

Run page → generate a run

Exterior viewer → Enter → explore

25. Known risks / pitfalls

Provider output scaling issues (FBX vs GLB). Mitigation: always normalize and scale.

Web performance with high-poly boss/exterior. Mitigation: optional decimation/compression later.

Prompt drift and schema failures. Mitigation: strict validation + repair.

3D provider unreliability. Mitigation: provider fallback and retries.

END OF IMMUTABLE DESIGN DOCUMENT

::contentReference[oaicite:0]{index=0}
