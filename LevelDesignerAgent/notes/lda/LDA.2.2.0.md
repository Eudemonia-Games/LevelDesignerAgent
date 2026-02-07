# LDA.2.2.0 Release Notes

**Date:** 2026-02-07
**Version:** LDA.2.2.0
**Focus:** Phase 2 - Worker Execution Framework

## Summary
Implements the core worker orchestration loop to claim, execute, and persist runs. Utilizes "Stub Stub" adapters for all stage kinds (Code, LLM, Image, 3D), producing deterministic outputs without external API calls. This enables end-to-end testing of the agentic pipeline flow.

## Changes

### 1. Worker Service
- **Orchestration Loop**: `poller.ts` claims `queued` runs (with `FOR UPDATE SKIP LOCKED`) and executes them.
- **Stage Execution**: Sequential execution of stages defined in `flow_stage_templates`.
- **Stub Adapters**: 
    - `llm`: Returns stub text + JSON.
    - `image`: Returns stub image metadata/notes.
    - `model3d`: Returns stub model metadata.
    - `code`: Returns deterministic echo.
- **Resilience**: Simple recovery for "stuck" running runs (older than 5 minutes).
- **Custom Mode**: Support for `breakpoint_after` pausing execution (`waiting_user`).

### 2. Database
- **New Types**: Added TypeScript interfaces for `Run`, `StageRun`, `RunEvent`.
- **Persistence**: 
    - Updates `runs` status (`running` -> `succeeded` / `failed` / `waiting_user`).
    - Creates `stage_runs` for each attempt.
    - Emits `run_events` for observability.
    - Updates `runs.context_json` with stage outputs.

## Verification Evidence

### Repo Mode Verification
Performed using `worker/verify_lda_2_2_0.js` against Neon Dev DB.

**1. Run Execution**
> Inserted Run `0871fab9-1165-4bae-aad4-9223984aa3b4`.
> Worker Claimed it.
> Executed 16 Stages (S1..S15).
> Final Status: `succeeded`.

**2. Events Log**
> Total 34 events (Claim + 16*Start + 16*Success + Run Success).

**3. Logs Snippet**
```text
[Worker] Claimed run 0871fab9... (status: running)
[Worker] Stage started: S1_PROMPT_ENHANCE
[Worker] Stage succeeded: S1_PROMPT_ENHANCE
...
[Worker] Run succeeded
```

### Render Mode Verification Plan
1. Deploy `lda-worker`.
2. Check `/health` on API (should be LDA.2.2.0).
3. Insert run via SQL Console:
   ```sql
   INSERT INTO runs (flow_version_id, mode, status, user_prompt, seed) 
   VALUES ('<FLOW_ID>', 'express', 'queued', 'render test', 1) 
   RETURNING id;
   ```
4. Watch Render logs for claim and execution.

## Known Issues / Follow-ups
- **Stubs Only**: No real generation yet.
- **No Artifacts**: R2 upload is next phase (2.4.0).
- **Handlebars**: Prompt templates are not yet observing variable subs (2.3.0).
