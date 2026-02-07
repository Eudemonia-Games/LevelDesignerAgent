export const SCHEMA_SQL = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
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

-- Tables

-- auth_sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);

-- secrets
CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY,
  algo TEXT NOT NULL DEFAULT 'AES-256-GCM',
  ciphertext_base64 TEXT NOT NULL,
  nonce_base64 TEXT NOT NULL,
  tag_base64 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- flow_versions
CREATE TABLE IF NOT EXISTS flow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
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

-- flow_stage_templates
CREATE TABLE IF NOT EXISTS flow_stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_version_id UUID NOT NULL REFERENCES flow_versions(id) ON DELETE CASCADE,

  stage_key TEXT NOT NULL,
  order_index INT NOT NULL,
  kind provider_kind NOT NULL,
  provider provider_id NOT NULL,
  model_id TEXT NOT NULL DEFAULT '',

  prompt_template TEXT NOT NULL DEFAULT '',

  attachments_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  input_bindings_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  provider_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  output_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  routing_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  breakpoint_after BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(flow_version_id, stage_key),
  UNIQUE(flow_version_id, order_index)
);

-- runs
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_version_id UUID NOT NULL REFERENCES flow_versions(id),

  mode run_mode NOT NULL DEFAULT 'express',
  status run_status NOT NULL DEFAULT 'queued',

  user_prompt TEXT NOT NULL,
  seed INT NOT NULL DEFAULT 0,

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

-- stage_runs
CREATE TABLE IF NOT EXISTS stage_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

  stage_key TEXT NOT NULL,
  attempt INT NOT NULL DEFAULT 1,

  status stage_status NOT NULL DEFAULT 'pending',
  user_notes TEXT NOT NULL DEFAULT '',

  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,

  resolved_prompt TEXT NOT NULL DEFAULT '',

  resolved_vars_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  resolved_image_inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  produced_artifacts_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  error_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE(run_id, stage_key, attempt)
);

CREATE INDEX IF NOT EXISTS stage_runs_run_stage_idx ON stage_runs (run_id, stage_key);

-- run_events
CREATE TABLE IF NOT EXISTS run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  stage_key TEXT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_events_run_created_idx ON run_events (run_id, created_at ASC);

-- assets
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  asset_key_hash TEXT NOT NULL UNIQUE,

  kind asset_kind NOT NULL,

  tile_role tile_role NULL,
  prop_category prop_category NULL,
  slug TEXT NOT NULL DEFAULT '',

  provider provider_id NOT NULL DEFAULT 'internal',
  model_id TEXT NOT NULL DEFAULT '',
  prompt_text TEXT NOT NULL DEFAULT '',
  prompt_hash TEXT NOT NULL DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_kind_idx ON assets (kind);
CREATE INDEX IF NOT EXISTS assets_slug_idx ON assets (slug);

-- asset_files
CREATE TABLE IF NOT EXISTS asset_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  file_kind asset_kind NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  bytes_size BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',

  width_px INT NULL,
  height_px INT NULL,

  tri_count INT NULL,
  bounds_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_files_asset_idx ON asset_files (asset_id);

-- run_asset_links
CREATE TABLE IF NOT EXISTS run_asset_links (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  usage_stage_key TEXT NOT NULL,
  usage_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, asset_id, usage_stage_key)
);

CREATE INDEX IF NOT EXISTS run_asset_links_run_idx ON run_asset_links (run_id);

-- jobs (Generic background tasks)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', 
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NULL,
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at ASC);

-- Backfill/Migration Fixes
DO $$ BEGIN
  ALTER TABLE stage_runs ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
`;
