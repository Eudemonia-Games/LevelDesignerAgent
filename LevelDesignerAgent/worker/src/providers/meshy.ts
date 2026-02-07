import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';
import { getSignedDownloadUrl } from '../storage/r2';

export class MeshyProvider implements ProviderAdapter {
    private apiKey: string | undefined;
    // ...

    private static instance: MeshyProvider | null = null;

    constructor() {
        this.apiKey = process.env.MESHY_API_KEY;
        if (!this.apiKey) {
            console.warn("MESHY_API_KEY not set. MeshyProvider will fail if used.");
        }
    }

    static getInstance(): MeshyProvider {
        if (!MeshyProvider.instance) {
            MeshyProvider.instance = new MeshyProvider();
        }
        return MeshyProvider.instance;
    }

    async generate3D(prompt: string, options: any = {}): Promise<any> {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 5000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this._generate3DInternal(prompt, options);
            } catch (err: any) {
                const isRateLimit = err.message.includes('429');
                if (isRateLimit && attempt < MAX_RETRIES) {
                    console.warn(`[Meshy] Rate limit hit. Waiting ${RETRY_DELAY_MS}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    continue;
                }
                throw err;
            }
        }
    }

    private async _generate3DInternal(prompt: string, options: any = {}): Promise<any> {
        let apiKey = this.apiKey;
        if (options && options._secrets && options._secrets['MESHY_API_KEY']) {
            apiKey = options._secrets['MESHY_API_KEY'];
        }

        if (!apiKey) throw new Error("MESHY_API_KEY not configured (Env or DB Secret)");

        // Resolve image_asset_id if provided
        if (options.image_asset_id) {
            try {
                const { getAssetFileR2Key } = await import('../db/assets');
                const r2Key = await getAssetFileR2Key(options.image_asset_id);
                if (r2Key) {
                    console.log(`[Meshy] Resolving asset ${options.image_asset_id} -> ${r2Key}...`);
                    const signedUrl = await getSignedDownloadUrl(r2Key, 3600);
                    options.image_url = signedUrl;
                    console.log(`[Meshy] Using resolved signed URL for Image-to-3D.`);
                } else {
                    console.warn(`[Meshy] Asset ${options.image_asset_id} has no file/key.`);
                }
            } catch (err: any) {
                console.warn(`[Meshy] Failed to resolve asset ID: ${err.message}`);
            }
        }

        // Parse <GEOMETRY_REF:role> tag
        let finalPrompt = prompt;
        const refMatch = prompt.match(/<GEOMETRY_REF:([\w_]+)>/);
        if (refMatch) {
            const role = refMatch[1];
            try {
                const key = `assets/refs/ref_${role}.png`;
                console.log(`[Meshy] Found Geometry Ref tag: ${role}. Fetching URL for ${key}...`);
                // Get signed URL (valid for 1 hour)
                const signedUrl = await getSignedDownloadUrl(key, 3600);
                options.image_url = signedUrl;
                finalPrompt = prompt.replace(refMatch[0], '').trim();
            } catch (err: any) {
                console.warn(`[Meshy] Failed to resolve geometry ref for ${role}: ${err.message}`);
            }
        }

        let url = 'https://api.meshy.ai/v2/text-to-3d';
        let payload: any = {
            mode: 'preview',
            prompt: finalPrompt,
            art_style: 'realistic',
            should_remesh: true,
            ...options
        };

        if (options.image_url) {
            console.log(`[Meshy] Using Image-to-3D with url: ${options.image_url}`);
            url = 'https://api.meshy.ai/v1/image-to-3d';
            payload = {
                image_url: options.image_url,
                enable_pbr: true,
                ...options
            };
            delete payload.prompt;
            delete payload.mode;
            delete payload.art_style;
        }

        const startResp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!startResp.ok) {
            if (startResp.status === 429) throw new Error(`Meshy API Rate Limit: 429`);
            throw new Error(`Meshy API Error: ${startResp.statusText} ${await startResp.text()}`);
        }

        const startData = await startResp.json();
        const taskId = startData.result;

        // Poll
        let taskData;
        let retries = 0;
        const maxRetries = 120; // Increased to 4 minutes for safety

        while (retries < maxRetries) {
            await new Promise(r => setTimeout(r, 2000));
            const pollUrl = options.image_url
                ? `https://api.meshy.ai/v1/image-to-3d/${taskId}`
                : `https://api.meshy.ai/v2/text-to-3d/${taskId}`;

            const pollResp = await fetch(pollUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            taskData = await pollResp.json();

            if (taskData.status === 'SUCCEEDED') break;
            if (taskData.status === 'FAILED') throw new Error(`Meshy Task Failed: ${taskData.task_error?.message}`);

            retries++;
        }

        if (!taskData || taskData.status !== 'SUCCEEDED') {
            throw new Error("Meshy Task Timed Out");
        }
        return taskData;
    }

    async run(run: Run, stage: FlowStageTemplate, _attempt: number, _context: any, prompt: string): Promise<ProviderOutput> {
        const modelId = stage.model_id || 'meshy-4';
        console.log(`[Meshy] Calling ${modelId} for stage ${stage.stage_key}...`);

        const taskData = await this.generate3D(prompt, { ..._context });

        // Download GLB
        const glbUrl = taskData.model_urls.glb;
        const glbResp = await fetch(glbUrl);
        const glbBuffer = await glbResp.arrayBuffer();

        return {
            provider_result: taskData,
            _artifacts: [
                {
                    kind: 'exterior_model_source',
                    slug: `${run.id}_${stage.stage_key}_model`,
                    data: Buffer.from(glbBuffer)
                }
            ]
        };
    }
}
