import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';
import * as fal from '@fal-ai/serverless-client';

export class FalProvider implements ProviderAdapter {
    private static instance: FalProvider | null = null;

    constructor() {
        if (!process.env.FAL_KEY) {
            console.warn("FAL_KEY not set. FalProvider will fail if used.");
        } else {
            fal.config({
                credentials: process.env.FAL_KEY
            });
        }
    }

    static getInstance(): FalProvider {
        if (!FalProvider.instance) {
            FalProvider.instance = new FalProvider();
        }
        return FalProvider.instance;
    }

    async generateImage(prompt: string, model: string = 'fal-ai/flux-pro', options: any = {}): Promise<any> {
        let apiKey = process.env.FAL_KEY;

        if (options && options._secrets && options._secrets['FAL_API_KEY']) {
            apiKey = options._secrets['FAL_API_KEY'];
        }

        if (!apiKey) throw new Error("FAL_KEY not configured (Env or DB Secret)");

        // Configure FAL for this request essentially. 
        // fal-serverless-client is a singleton-ish lib usually.
        // We might need to check if we can pass credentials per request or if we must re-config.
        // The fal-ai/serverless-client docs (implied) suggests `fal.config({ credentials })`.
        // This might be global state. If we have concurrent runs with different keys (unlikely in this single-tenant agent), it might be an issue.
        // But for now, setting it here is fine.
        fal.config({ credentials: apiKey });

        return await fal.subscribe(model, {
            input: {
                prompt: prompt,
                image_size: 'landscape_4_3',
                num_inference_steps: 25,
                guidance_scale: 3.5,
                ...options
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log(`[Fal] ${model}: ${update.logs.map(l => l.message).join('\n')}`);
                }
            }
        });
    }

    async run(run: Run, stage: FlowStageTemplate, _attempt: number, _context: any, prompt: string): Promise<ProviderOutput> {
        const model = stage.model_id || 'fal-ai/flux-pro';
        console.log(`[Fal] Calling ${model} for stage ${stage.stage_key}...`);

        const result = await this.generateImage(prompt, model, { ..._context });

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
