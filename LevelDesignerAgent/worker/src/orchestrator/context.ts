import { Run, StageRun } from '../db/types';

export interface RunContext {
    run: {
        id: string;
        user_prompt: string;
        seed: number;
        mode: string;
    };
    outputs: Record<string, any>;
    [key: string]: any; // Allow direct access to stage keys at root level for convenience
}

export function buildRunContext(run: Run, stageRuns: StageRun[]): RunContext {
    const context: RunContext = {
        run: {
            id: run.id,
            user_prompt: run.user_prompt,
            seed: run.seed,
            mode: run.mode
        },
        outputs: {},
        // Spread existing run context (inputs, constraints, etc) to root
        ...run.context_json,
        // Explicitly ensure 'context' object exists for Stage outputs
        context: run.context_json.context || {}
    };

    // Index latest successful stage runs
    // We assume stageRuns is a list of relevant stage runs. 
    // Usually executeRun fetches "latest" for each key.
    for (const sr of stageRuns) {
        if (sr.status === 'succeeded' || sr.status === 'skipped') {
            const data = {
                output: sr.output_json,
                artifacts: sr.produced_artifacts_json
            };

            // Nested under 'outputs' for clarity
            context.outputs[sr.stage_key] = data;

            // And also at context.context.[StageKey] to match seed bindings like $.context.S1...
            context.context[sr.stage_key] = data;
        }
    }

    return context;
}
