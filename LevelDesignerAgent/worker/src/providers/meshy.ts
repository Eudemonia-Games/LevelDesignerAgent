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
        if (!this.apiKey) throw new Error("MESHY_API_KEY not configured");

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
                // Proceed without image, or fail? Proceed for now.
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

        // Switch to Image-to-3D if image_url provided
        // Note: Meshy API usually separates these. v1/image-to-3d is common, but checking v2 docs (assumed):
        // If image_url is present, we use the image-to-3d endpoint.
        if (options.image_url) {
            console.log(`[Meshy] Using Image-to-3D with url: ${options.image_url}`);
            url = 'https://api.meshy.ai/v1/image-to-3d';
            payload = {
                image_url: options.image_url,
                enable_pbr: true,
                ...options
            };
            // Remove text-to-3d specific fields if they are in options
            delete payload.prompt;
            delete payload.mode;
            delete payload.art_style;
        }

        const startResp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!startResp.ok) {
            throw new Error(`Meshy API Error: ${startResp.statusText} ${await startResp.text()}`);
        }

        const startData = await startResp.json();
        const taskId = startData.result;

        // Poll
        let taskData;
        let retries = 0;
        const maxRetries = 60; // 2 minutes approx

        while (retries < maxRetries) {
            await new Promise(r => setTimeout(r, 2000));
            // Polling endpoint is different for image-to-3d in v1 typically? 
            // Usually Meshy uses generic task ID lookup or specific endpoint.
            // As per common pattern, it's often the same or /v1/image-to-3d/{id}.
            const pollUrl = options.image_url
                ? `https://api.meshy.ai/v1/image-to-3d/${taskId}`
                : `https://api.meshy.ai/v2/text-to-3d/${taskId}`;

            const pollResp = await fetch(pollUrl, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
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

        const taskData = await this.generate3D(prompt);

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
