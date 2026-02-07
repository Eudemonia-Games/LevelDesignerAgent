import * as crypto from 'crypto';
import { Run, FlowStageTemplate } from '../db/types';

export function generateStubOutput(run: Run, stage: FlowStageTemplate, attempt: number): any {
    const base = JSON.stringify({
        runId: run.id,
        userPrompt: run.user_prompt,
        seed: run.seed,
        stageKey: stage.stage_key,
        attempt,
        kind: stage.kind,
        provider: stage.provider
    });

    // Deterministic hash
    const digest = crypto.createHash('sha256').update(base).digest('hex').substring(0, 16);

    const common = {
        stub: true,
        kind: stage.kind,
        stage_key: stage.stage_key,
        attempt,
        digest,
        timestamp: "NO_TIMESTAMP_IN_STUB"
    };

    switch (stage.kind) {
        case 'code':
            return {
                ...common,
                echo: { user_prompt: run.user_prompt, seed: run.seed }
            };
        case 'llm':
            return {
                ...common,
                text: `STUB LLM OUTPUT for ${stage.stage_key} (Provider: ${stage.provider})`,
                json_stub: {
                    analysis: "This is a stub",
                    score: 9000
                }
            };
        case 'image':
            return {
                ...common,
                image_note: "STUB IMAGE - R2 ready",
                width: 1024,
                height: 1024,
                _artifacts: [
                    {
                        kind: 'grid_image',
                        slug: `${run.id}_${stage.stage_key}_grid`,
                        data: `FAKE_IMAGE_DATA_FOR_${stage.stage_key}_${attempt}`
                    }
                ]
            };
        case 'model3d':
            return {
                ...common,
                model_note: "STUB 3D MODEL - R2 ready",
                triangles: 10000,
                _artifacts: [
                    {
                        kind: 'exterior_model_source',
                        slug: `${run.id}_${stage.stage_key}_model`,
                        data: `FAKE_MODEL_DATA_FOR_${stage.stage_key}_${attempt}` // In reality this would be a buffer passed through
                    }
                ]
            };
        default:
            return {
                ...common,
                unknown: true
            };
    }
}
