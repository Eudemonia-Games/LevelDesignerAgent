# LDA.2.3.0 Release Notes

**Date:** 2026-02-07
**Version:** LDA.2.3.0
**Focus:** Phase 2.3 - Context Model + Template Resolver (Handlebars)

## Summary
Implements the Handlebars-based template resolution system in the Worker. This allows stage prompts to dynamically reference run data (like `user_prompt`) and outputs from previous stages. It is the "glue" that turns a sequence of isolated stages into a coherent pipeline.

## Changes

### 1. Worker Dependencies
- Added `handlebars` (4.7.8) for template rendering.

### 2. Context Logic (`worker/src/orchestrator/context.ts`)
- **`buildRunContext(run, stageRuns)`**: Constructs the data object passed to Handlebars.
- **Structure**:
  ```json
  {
    "run": {
      "id": "...",
      "user_prompt": "Make a spooky castle",
      "seed": 123
    },
    // Direct access to previous stage outputs by key
    "S1_PROMPT_ENHANCE": {
      "output": { "enhanced_prompt": "..." },
      "artifacts": []
    },
    // Alias for clearer usage in templates
    "outputs": {
      "S1_PROMPT_ENHANCE": ...
    }
  }
  ```

### 3. Resolver Logic (`worker/src/orchestrator/resolver.ts`)
- **`resolvePrompt(template, context)`**: Compiles and renders the string.
- Handles basic errors (missing keys, syntax errors) gracefully (throws or returns empty?).
- Decisions: Throws error to fail the stage if template is invalid.

### 4. Database Updates (`worker/src/db/jobs.ts`)
- Updated `createStageRun` to accept `resolvedVarsJson`.

### 5. Orchestrator Integration (`worker/src/orchestrator/executeRun.ts`)
- Before creating a stage run:
  1. Build context.
  2. Resolve `prompt_template`.
  3. Store `resolved_prompt` and snapshots of used vars in `stage_runs`.

## Verification Plan

### Repo Mode
- Run `worker/verify_lda_2_3_0.ts`
- Inserts a FlowVersion with a stage having prompt: `Echo: {{run.user_prompt}}`
- Worker executes it.
- Verification script checks `stage_runs.resolved_prompt` matches `Echo: <original_input>`.
