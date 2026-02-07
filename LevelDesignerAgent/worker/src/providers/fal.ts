import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';
import * as fal from '@fal-ai/serverless-client';

export class FalProvider implements ProviderAdapter {
    constructor() {
        if (!process.env.FAL_KEY) {
            console.warn("FAL_KEY not set. FalProvider will fail if used.");
        } else {
            fal.config({
                credentials: process.env.FAL_KEY
            });
        }
    }

    async run(run: Run, stage: FlowStageTemplate, attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        if (!process.env.FAL_KEY) {
            throw new Error("FAL_KEY not configured");
        }

        const model = stage.model_id || 'fal-ai/flux-pro';
        console.log(`[Fal] Calling ${model} for stage ${stage.stage_key}...`);

        // Fal usually returns { images: [{ url: ... }] } for image models
        const result: any = await fal.subscribe(model, {
            input: {
                prompt: prompt,
                // Add common params
                image_size: 'landscape_4_3',
                num_inference_steps: 25,
                guidance_scale: 3.5
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log(`[Fal] ${model}: ${update.logs.map(l => l.message).join('\n')}`);
                }
            }
        });

        const artifacts: any[] = [];

        if (result.images && Array.isArray(result.images)) {
            for (let i = 0; i < result.images.length; i++) {
                const img = result.images[i];
                // Fetch the image data to store in R2
                const resp = await fetch(img.url);
                const buffer = await resp.arrayBuffer();

                artifacts.push({
                    kind: 'grid_image', // Defaulting to grid_image for now
                    slug: `${run.id}_${stage.stage_key}_${i}`,
                    data: Buffer.from(buffer)
                });
            }
        }

        return {
            provider_result: result,
            _artifacts: artifacts
        };
    }
}
