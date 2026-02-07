import OpenAI from 'openai';
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class OpenAIProvider implements ProviderAdapter {
    private client: OpenAI | null = null;
    private apiKeyName: string = 'OPENAI_API_KEY';

    constructor(config: { apiKeyName?: string; baseURL?: string } = {}) {
        this.apiKeyName = config.apiKeyName || 'OPENAI_API_KEY';
        const apiKey = process.env[this.apiKeyName];

        if (apiKey) {
            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: config.baseURL
            });
        }
    }

    async generateText(prompt: string, model: string = 'gpt-4o', options: any = {}): Promise<any> {
        let clientToUse = this.client;

        // Check for injected secrets in options (passed from run context)
        // We look for options._secrets[this.apiKeyName]
        if (options && options._secrets && options._secrets[this.apiKeyName]) {
            const secretKey = options._secrets[this.apiKeyName];
            // Create temporary client
            // If baseURL is needed, we need to know it. 
            // We can store config in the instance to reuse baseURL.
            // But for now, let's assume if we are injecting secrets, we might miss baseURL if it was set in constructor config but not saved?
            // Constructor saves apiKeyName. It passes baseURL to client. 
            // We should save baseURL in the class to reuse it.
            // BUT, we can just try to use the secret.
            // For Gemini, baseURL is crucial.

            // HACK: Re-read config from env if possible or save it?
            // Let's modify constructor to save baseURL.
            // For now, let's just use the client if it exists, OR create new one.
            // Actually, if we are using Secrets, `this.client` might be null!

            // Let's rely on `this.client` being configured with *something* (e.g. env) OR we create one here.
            // If we create one here, we need baseURL.

            // Let's check if this.client exists. If so, and key matches, use it.
            // But the whole point is `this.client` might NOT exist if env var is missing.

            // We need to know the baseURL for Gemini.
            // We can check `this.apiKeyName`. If it's GEMINI_API_KEY, we know the URL.
            let baseURL = undefined;
            if (this.apiKeyName === 'GEMINI_API_KEY') {
                baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            }

            clientToUse = new OpenAI({
                apiKey: secretKey,
                baseURL: baseURL
            });
        }

        if (!clientToUse) throw new Error(`${this.apiKeyName} not configured (Env or DB Secret)`);

        const completion = await clientToUse.chat.completions.create({
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
        // Map Gemini models if needed (legacy/experimental aliases)
        let modelToUse = model;
        if (model === 'gemini-2.0-flash') {
            console.warn(`[OpenAI] Remapping gemini-2.0-flash to gemini-1.5-flash for compatibility`);
            modelToUse = 'gemini-1.5-flash';
        }

        console.log(`[OpenAI] Calling ${modelToUse} (requested: ${model}) for stage ${stage.stage_key}...`);

        let clientToUse = this.client;

        // Check for injected secrets in context
        if (_context && _context._secrets && _context._secrets[this.apiKeyName]) {
            const secretKey = _context._secrets[this.apiKeyName];
            let baseURL = undefined;
            if (this.apiKeyName === 'GEMINI_API_KEY') {
                baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            }

            clientToUse = new OpenAI({
                apiKey: secretKey,
                baseURL: baseURL
            });
        }

        if (!clientToUse) throw new Error(`${this.apiKeyName} not configured (Env or DB Secret)`);

        const options: any = {
            ..._context
        };

        // ... existing legacy checks ...

        const messages: any[] = [
            { role: 'system', content: "You are a Level Design Assistant." }
        ];

        const userContent: any[] = [];
        let cleanPrompt = prompt;

        // Extract image tags: [IMAGE:url]
        const imgRegex = /\[IMAGE:(.+?)\]/g;
        let match;
        while ((match = imgRegex.exec(prompt)) !== null) {
            const url = match[1];
            userContent.push({
                type: "image_url",
                image_url: { url: url }
            });
            cleanPrompt = cleanPrompt.replace(match[0], '');
        }

        userContent.push({ type: "text", text: cleanPrompt.trim() });

        messages.push({ role: 'user', content: userContent });

        try {
            const completion = await clientToUse.chat.completions.create({
                model: modelToUse,
                messages: messages as any,
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
        } catch (err: any) {
            console.error(`[OpenAI] Request Failed:`, {
                model: modelToUse, // Log the actual model used
                requestedModel: model,
                apiKeyName: this.apiKeyName,
                error: err.message
            });
            if (err.status) {
                console.error(`[OpenAI] Status: ${err.status}`);
            }
            if (err.error) {
                console.error(`[OpenAI] Body:`, JSON.stringify(err.error, null, 2));
            }
            throw err;
        }
    }
}
