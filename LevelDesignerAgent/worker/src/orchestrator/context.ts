import { Run, StageRun } from '../db/types';

/**
 * Canonical run context shape for:
 * - Handlebars templates
 * - JSONPath bindings ("$.context.S1_PROMPT_ENHANCE.enhanced_prompt")
 *
 * IMPORTANT: Must stay consistent with how executeRun() writes run.context_json.context.
 */
export interface RunContext {
  run: {
    id: string;
    flow_version_id: string;
    mode: string;
    seed: number;
  };

  // Convenience aliases
  user_prompt: string;
  seed: number;
  mode: string;

  // Inputs passed at run creation time (from API)
  inputs: Record<string, any>;

  // Commonly used inputs (mirrors API seed templates)
  constraints?: any;
  tile_roles_supported?: any;
  prop_categories_supported?: any;

  // Stage outputs persisted on the run record.
  // Each stage_key maps to the stage output object + artifacts list.
  context: Record<string, any>;

  // Legacy alias (some older templates might use $.outputs.<stage>)
  outputs: Record<string, any>;

  // Allow arbitrary convenience keys (e.g. stage keys at root, _secrets, _vars)
  [key: string]: any;
}

export function buildRunContext(run: Run, stageRuns: StageRun[]): RunContext {
  const inputs = (run.context_json && run.context_json.inputs) ? run.context_json.inputs : {};
  const persistedContext = (run.context_json && run.context_json.context) ? run.context_json.context : {};

  const ctx: RunContext = {
    run: {
      id: run.id,
      flow_version_id: run.flow_version_id,
      mode: run.mode,
      seed: run.seed
    },
    user_prompt: run.user_prompt,
    seed: run.seed,
    mode: run.mode,

    inputs,
    constraints: inputs.constraints ?? run.context_json?.constraints,
    tile_roles_supported: inputs.tile_roles_supported ?? run.context_json?.tile_roles_supported,
    prop_categories_supported: inputs.prop_categories_supported ?? run.context_json?.prop_categories_supported,

    context: { ...persistedContext },
    outputs: { ...persistedContext }
  };

  // Also expose stage outputs from the latest successful stage runs (helps if run.context_json is behind)
  for (const sr of stageRuns) {
    if (sr.status === 'succeeded' || sr.status === 'skipped') {
      const outputObj = sr.output_json ?? {};
      const stageObj = {
        ...outputObj,
        artifacts: sr.produced_artifacts_json ?? []
      };
      ctx.context[sr.stage_key] = stageObj;
      ctx.outputs[sr.stage_key] = stageObj;
      // root alias for convenience: {{S2_LAYOUT_PLAN.some_field}}
      (ctx as any)[sr.stage_key] = stageObj;
    }
  }

  // Root aliases for common prompt templates
  (ctx as any).constraints = ctx.constraints;
  (ctx as any).tile_roles_supported = ctx.tile_roles_supported;
  (ctx as any).prop_categories_supported = ctx.prop_categories_supported;

  return ctx;
}
