import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class MeshyProvider implements ProviderAdapter {
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.MESHY_API_KEY;
        if (!this.apiKey) {
            console.warn("MESHY_API_KEY not set. MeshyProvider will fail if used.");
        }
    }

    async run(run: Run, stage: FlowStageTemplate, attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        if (!this.apiKey) {
            throw new Error("MESHY_API_KEY not configured");
        }

        const modelId = stage.model_id || 'meshy-4'; // or whatever the current model is
        console.log(`[Meshy] Calling ${modelId} for stage ${stage.stage_key}...`);

        // Start generation
        const startResp = await fetch('https://api.meshy.ai/v2/text-to-3d', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: 'preview', // fast generation for testing
                prompt: prompt,
                art_style: 'realistic',
                should_remesh: true
            })
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
            const pollResp = await fetch(`https://api.meshy.ai/v2/text-to-3d/${taskId}`, {
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
