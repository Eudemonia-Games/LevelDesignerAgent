
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class NanoBananaProvider implements ProviderAdapter {
    // private client: GoogleGenerativeAI | null = null; // Unused

    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = context._secrets['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in secrets");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // this.client = genAI;

        const modelId = stage.model_id || 'gemini-2.5-flash-image';
        const model = genAI.getGenerativeModel({ model: modelId });

        console.log(`[NanoBanana] Generating image with ${modelId}...`);

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
                    // const mimeType = part.inlineData.mimeType; // Unused

                    artifacts.push({
                        kind: 'image',
                        slug: `image_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        data: Buffer.from(base64, 'base64')
                    });
                }
            }

            if (artifacts.length === 0) {
                throw new Error(`No images generated. Output: ${response.text()}`);
            }

            return {
                _artifacts: artifacts,
                summary: "Image generated successfully"
            };

        } catch (e: any) {
            console.error("[NanoBanana] Error:", e);
            throw e;
        }
    }
}
