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
        let modelId = stage.model_id || 'gemini-1.5-flash';

        // Use a known stable model if specific preview causes issues, or trust the input.
        // gemini-3-flash-preview might be valid, so we keep it.

        console.log(`[Gemini] Generating text with ${modelId}...`);

        try {
            const model = genAI.getGenerativeModel({ model: modelId });

            const result = await model.generateContent(prompt);
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
