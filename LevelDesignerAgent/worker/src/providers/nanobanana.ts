import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class NanoBananaProvider implements ProviderAdapter {
    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = context._secrets['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in secrets");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // User requested "gemini 2.5 flash image", likely meaning the latest flash model capable of images.
        // gemini-2.0-flash-exp is the current robust preview.
        const modelId = stage.model_id || 'gemini-2.5-flash-image';
        const model = genAI.getGenerativeModel({ model: modelId });

        console.log(`[NanoBanana] Generating content with ${modelId}...`);

        try {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            const response = await result.response;
            const candidates = response.candidates;

            if (!candidates || candidates.length === 0) {
                throw new Error("No candidates returned");
            }

            const parts = candidates[0].content.parts;
            const artifacts: any[] = [];

            for (const part of parts) {
                if (part.inlineData) {
                    // It's an image
                    const base64 = part.inlineData.data;

                    artifacts.push({
                        kind: 'image',
                        slug: `image_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        data: Buffer.from(base64, 'base64')
                    });
                }
            }

            // Fallback: If no inline images, check if it returned text (maybe an error or refusal)
            if (artifacts.length === 0) {
                const text = response.text();
                throw new Error(`No images generated. Output text: ${text}`);
            }

            return {
                _artifacts: artifacts,
                summary: "Image generated successfully via Gemini SDK"
            };

        } catch (e: any) {
            console.error("[NanoBanana] Error:", e);
            throw e;
        }
    }
}
