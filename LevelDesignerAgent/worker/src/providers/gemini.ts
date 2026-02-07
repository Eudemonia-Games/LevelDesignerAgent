import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class GeminiProvider implements ProviderAdapter {
    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = context._secrets['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in secrets");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Handle model aliases
        // Handle model aliases / fallbacks
        let modelId = stage.model_id || 'gemini-2.5-flash-image';

        // Force user's requested model for everything
        if (modelId.includes('gemini-3') || modelId.includes('gemini-2.0')) {
            console.warn(`[Gemini] Remapping ${modelId} -> gemini-2.5-flash-image`);
            modelId = 'gemini-2.5-flash-image';
        }

        console.log(`[Gemini] Generating text with ${modelId}... (Prompt length: ${prompt.length})`);

        try {
            const model = genAI.getGenerativeModel({ model: modelId });

            // specific timeout to avoid worker hang/sigterm
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini Request Timed Out (60s)")), 60000));

            const result: any = await Promise.race([
                model.generateContent(prompt),
                timeoutPromise
            ]);

            const response = await result.response;
            const text = response.text();

            // Try to parse JSON if it looks like JSON (common for tool outputs)
            let json_data = {};
            if (text.trim().startsWith('{')) {
                try { json_data = JSON.parse(text); } catch (e) { }
            }

            return {
                text: text,
                ...json_data,
                summary: `Generated text via ${modelId}`
            };

        } catch (e: any) {
            console.error("[Gemini] Error:", e);
            throw e;
        }
    }
}
