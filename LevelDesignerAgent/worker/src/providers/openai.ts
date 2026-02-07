import OpenAI from 'openai';
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class OpenAIProvider implements ProviderAdapter {
    private client: OpenAI | null = null;

    constructor() {
        if (process.env.OPENAI_API_KEY) {
            this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        } else {
            console.warn("OPENAI_API_KEY not set. OpenAIProvider will fail if used.");
        }
    }

    async run(run: Run, stage: FlowStageTemplate, attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        if (!this.client) {
            // Fallback to stub if no key? Or fail? 
            // Phase 7 goal is REAL providers. Let's fail if no key.
            throw new Error("OPENAI_API_KEY not configured");
        }

        const model = stage.model_id || 'gpt-4o';
        const systemMsg = "You are a Level Design Assistant. Output valid JSON if requested.";

        console.log(`[OpenAI] Calling ${model} for stage ${stage.stage_key}...`);

        const completion = await this.client.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: systemMsg },
                { role: 'user', content: prompt }
            ],
            // If output_schema_json indicates JSON, we could force json_object mode, 
            // but for now let's keep it simple text unless template specifies.
        });

        const content = completion.choices[0].message.content || '';

        // Try to parse JSON if it looks like JSON
        let json_data = {};
        if (content.trim().startsWith('{')) {
            try {
                json_data = JSON.parse(content);
            } catch (e) {
                // Not valid JSON, ignore
            }
        }

        return {
            text: content,
            ...json_data,
            provider_metadata: {
                model,
                usage: completion.usage
            }
        };
    }
}
