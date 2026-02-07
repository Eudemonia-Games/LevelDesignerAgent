import OpenAI from 'openai';
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class OpenAIProvider implements ProviderAdapter {
    private static instance: OpenAIProvider | null = null;
    private client: OpenAI | null = null;

    constructor() {
        if (process.env.OPENAI_API_KEY) {
            this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        } else {
            console.warn("OPENAI_API_KEY not set. OpenAIProvider will fail if used.");
        }
    }

    static getInstance(): OpenAIProvider {
        if (!OpenAIProvider.instance) {
            OpenAIProvider.instance = new OpenAIProvider();
        }
        return OpenAIProvider.instance;
    }

    async generateText(prompt: string, model: string = 'gpt-4o', options: any = {}): Promise<any> {
        if (!this.client) throw new Error("OPENAI_API_KEY not configured");

        const completion = await this.client.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: "You are a Level Design Assistant." },
                { role: 'user', content: prompt }
            ],
            ...options
        });

        const content = completion.choices[0].message.content || '';

        let json_data = {};
        if (content.trim().startsWith('{')) {
            try { json_data = JSON.parse(content); } catch (e) { }
        }

        return {
            text: content,
            ...json_data,
            usage: completion.usage
        };
    }

    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, _context: any, prompt: string): Promise<ProviderOutput> {
        const model = stage.model_id || 'gpt-4o';
        console.log(`[OpenAI] Calling ${model} for stage ${stage.stage_key}...`);

        const result = await this.generateText(prompt, model);

        // Map back to ProviderOutput
        // result has text, maybe json fields, usage.
        const { text, usage, ...rest } = result;

        return {
            text: text,
            ...rest,
            provider_metadata: {
                model,
                usage
            }
        };
    }
}
