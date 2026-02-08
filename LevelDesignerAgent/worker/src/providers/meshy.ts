import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';
import { getSignedDownloadUrl } from '../storage/r2';

type MeshyTask = any;

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

function pick<T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> {
    const out: any = {};
    for (const k of keys) {
        if (obj && obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
}

export class MeshyProvider implements ProviderAdapter {
    private apiKey: string | undefined;

    private static instance: MeshyProvider | null = null;

    constructor() {
        this.apiKey = process.env.MESHY_API_KEY;
        if (!this.apiKey) {
            console.warn('MESHY_API_KEY not set. MeshyProvider will fail if used.');
        }
    }

    static getInstance(): MeshyProvider {
        if (!MeshyProvider.instance) {
            MeshyProvider.instance = new MeshyProvider();
        }
        return MeshyProvider.instance;
    }

    private async resolveImageUrlFromAssetId(imageAssetId: string): Promise<string | null> {
        try {
            const { getAssetFileR2Key } = await import('../db/assets');
            const r2Key = await getAssetFileR2Key(imageAssetId);
            if (!r2Key) return null;
            return await getSignedDownloadUrl(r2Key, 3600);
        } catch (e: any) {
            console.warn(`[Meshy] Failed to resolve image_asset_id ${imageAssetId}: ${e?.message}`);
            return null;
        }
    }

    private getKeyFromContext(context: any): string | undefined {
        const k = context?._secrets?.['MESHY_API_KEY'];
        return k || this.apiKey;
    }

    private async postJson(url: string, apiKey: string, payload: any) {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await resp.text();
        if (!resp.ok) {
            if (resp.status === 429) throw new Error('Meshy API Rate Limit: 429');
            throw new Error(`Meshy API Error: ${resp.status} ${resp.statusText} ${text}`);
        }
        return JSON.parse(text);
    }

    private async getJson(url: string, apiKey: string) {
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const text = await resp.text();
        if (!resp.ok) {
            throw new Error(`Meshy API Poll Error: ${resp.status} ${resp.statusText} ${text}`);
        }
        return JSON.parse(text);
    }

    private async pollTask(pollUrl: string, apiKey: string, maxRetries = 300, intervalMs = 4000): Promise<MeshyTask> {
        for (let i = 0; i < maxRetries; i++) {
            await sleep(intervalMs);
            const task = await this.getJson(pollUrl, apiKey);
            console.log(`[Meshy] Polling task... Status: ${task?.status || task?.result?.status} (Attempt ${i + 1}/${maxRetries})`);

            const status = task?.status || task?.result?.status;
            const data = task?.result || task;

            if (status === 'SUCCEEDED' || data?.status === 'SUCCEEDED') return data;
            if (status === 'FAILED' || data?.status === 'FAILED') {
                const err = data?.task_error?.message || data?.error?.message || 'Unknown Meshy failure';
                throw new Error(`Meshy Task Failed: ${err}`);
            }
        }
        throw new Error('Meshy Task Timed Out');
    }

    private async generateTextTo3D(prompt: string, apiKey: string, providerConfig: any): Promise<MeshyTask> {
        const url = 'https://api.meshy.ai/openapi/v2/text-to-3d';

        // Only allow whitelisted fields to avoid leaking huge context blobs
        const allowed = pick(providerConfig || {}, [
            'mode',
            'art_style',
            'should_remesh',
            'enable_pbr',
            'seed',
            'negative_prompt',
            'topology',
            'target_polycount'
        ]);

        const payload: any = {
            mode: 'preview',
            prompt,
            art_style: 'realistic',
            should_remesh: true,
            ...allowed
        };

        const startData = await this.postJson(url, apiKey, payload);
        const taskId = startData?.result || startData?.id;
        if (!taskId) throw new Error(`Meshy text-to-3d did not return a task id: ${JSON.stringify(startData).slice(0, 500)}`);

        const pollUrl = `https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`;
        return await this.pollTask(pollUrl, apiKey);
    }

    private async generateImageTo3D(imageUrl: string, apiKey: string, providerConfig: any): Promise<MeshyTask> {
        const url = 'https://api.meshy.ai/openapi/v1/image-to-3d';

        const allowed = pick(providerConfig || {}, [
            'enable_pbr',
            'should_remesh',
            'seed',
            'negative_prompt',
            'target_polycount'
        ]);

        const payload: any = {
            image_url: imageUrl,
            enable_pbr: true,
            ...allowed
        };

        const startData = await this.postJson(url, apiKey, payload);
        const taskId = startData?.result || startData?.id;
        if (!taskId) throw new Error(`Meshy image-to-3d did not return a task id: ${JSON.stringify(startData).slice(0, 500)}`);

        const pollUrl = `https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`;
        return await this.pollTask(pollUrl, apiKey);
    }

    async run(run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = this.getKeyFromContext(context);
        if (!apiKey) throw new Error('MESHY_API_KEY not configured (Env or DB Secret)');

        const providerConfig = stage.provider_config_json || {};

        // Variables resolved from bindings (executeRun sets context._vars)
        const vars = context?._vars || {};

        // Optional: image_asset_id binding (e.g. to run image-to-3d)
        let imageUrl: string | null = null;
        if (vars.image_asset_id) {
            imageUrl = await this.resolveImageUrlFromAssetId(String(vars.image_asset_id));
        }

        // Also allow explicit image_url (e.g. from GEOMETRY_REF)
        if (!imageUrl && vars.image_url) {
            imageUrl = String(vars.image_url);
        }

        // Parse <GEOMETRY_REF:role> tag (kept for backward compatibility)
        let finalPrompt = prompt;
        const refMatch = prompt.match(/<GEOMETRY_REF:([\w_]+)>/);
        if (refMatch) {
            const role = refMatch[1];
            try {
                const key = `assets/refs/ref_${role}.png`;
                console.log(`[Meshy] Found Geometry Ref tag: ${role}. Fetching URL for ${key}...`);
                imageUrl = await getSignedDownloadUrl(key, 3600);
                finalPrompt = prompt.replace(refMatch[0], '').trim();
            } catch (err: any) {
                console.warn(`[Meshy] Failed to resolve geometry ref for ${role}: ${err.message}`);
            }
        }

        console.log(`[Meshy] Stage ${stage.stage_key} starting. Mode=${imageUrl ? 'image-to-3d' : 'text-to-3d'}`);

        const taskData = imageUrl
            ? await this.generateImageTo3D(imageUrl, apiKey, providerConfig)
            : await this.generateTextTo3D(finalPrompt, apiKey, providerConfig);

        // Try to find GLB URL in common response shapes
        const glbUrl =
            taskData?.model_urls?.glb ||
            taskData?.result?.model_urls?.glb ||
            taskData?.model?.glb ||
            taskData?.glb_url;

        if (!glbUrl) {
            throw new Error(`Meshy task succeeded but GLB URL missing. Keys: ${Object.keys(taskData || {}).join(', ')}`);
        }

        const glbResp = await fetch(glbUrl);
        if (!glbResp.ok) {
            throw new Error(`Failed to download GLB from Meshy: ${glbResp.status} ${glbResp.statusText}`);
        }
        const glbBuffer = await glbResp.arrayBuffer();

        return {
            provider_result: taskData,
            _artifacts: [
                {
                    kind: 'exterior_model_source',
                    file_kind: 'glb',
                    mime_type: 'model/gltf-binary',
                    file_ext: 'glb',
                    slug: `${run.id}_${stage.stage_key}_model`,
                    data: Buffer.from(glbBuffer)
                }
            ]
        };
    }
}
