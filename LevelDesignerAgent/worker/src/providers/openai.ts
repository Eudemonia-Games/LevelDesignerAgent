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
        console.log(`[OpenAI] Calling ${model} for stage ${stage.stage_key}...`);

        // if (!this.client) throw new Error(`${this.apiKeyName} not configured`); // Handled in generateText

        const options: any = {
            ..._context // Pass full context including _secrets
        };

        // Handle Vision / Attachments
        // We look for 'image_url' in options or specific context bindings if needed, 
        // but for now let's support a convention: binding 'grid_image' to a signed URL or base64.
        // In seed.ts, S4_PLACEMENT_PLAN has input_bindings_json with "layout_plan". 
        // It also has 'attachments_policy_json': { "S3_RENDER_GRID_IMAGE": "required" }
        // The Orchestrator resolves input bindings, but attachments are separate.

        // However, for simplicity in this "Vision" feature, let's assume if the prompt 
        // contains <IMAGE_REF:url> or if specific context keys exist, we format it.
        // Better yet, let's look at the `prompt` - if it's just text, we send text.
        // If we want to attach an image, we need a way to pass it.

        // HACK: We will check if `context.S3_RENDER_GRID_IMAGE` exists (which is the output of the code stage).
        // The code stage S3 returns { ... } output. 
        // Actually, S3 creates an *artifact*.

        // Let's rely on a specific binding convention. If `context.grid_image_url` is present, use it.
        // But `S3` creates an artifact. We might need to generate a signed URL for that artifact.

        // Allow the caller (Orchestrator) to have already resolved this? 
        // No, Orchestrator just passes `context`.
        // Let's simply support `options.images` where options comes from `provider_config_json` OR 
        // we parse the prompt for a special tag? 
        // The user asked: "How are we generating and supplying the layout grid image...?"

        // Let's implement a robust way: 
        // If `stage.input_bindings_json` binds something to `image_url` or `images`, we use it.
        // But we only have `prompt`.

        // Let's look for `images` in the `context` root if it was bound? 
        // Actually, `resolveInput` in orchestrator merges bindings into `prompt` (via Handlebars) or `context`?
        // `resolveInput` returns a resolved string (prompt).

        // We need a way to pass non-string data.
        // In `executeRun.ts`, we see: `const prompt = await resolveInput(...)`. This returns a string.

        // SOLUTION: We will allow the prompt to contain a JSON block or specific tags for images.
        // OR: We check `context.latest_image_url`?

        // Let's go with this: in `seed.ts`, we can bind the image URL to a variable, e.g. `{{grid_image_url}}`.
        // But the artifact is stored in R2.
        // The `InternalProvider` (S3) should return the *Signed URL* or *Public URL* in its JSON output.
        // Then we bind that to the prompt or a specialized field.

        // Modified approach:
        // OpenAI `messages` content can be array of `{type: text, text: ...}, {type: image_url, ...}`.
        // We will parse the `prompt` string. If it contains `[IMAGE_URL: https://...]` we extract it.

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
            cleanPrompt = cleanPrompt.replace(match[0], ''); // Remove tag from text
        }

        userContent.push({ type: "text", text: cleanPrompt.trim() });

        messages.push({ role: 'user', content: userContent });

        const completion = await this.client!.chat.completions.create({
            model: model,
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
    }
}
