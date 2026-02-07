
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class NanoBananaProvider implements ProviderAdapter {
    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = context._secrets['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in secrets");
        }

        // Map models to latest valid ones
        let modelId = stage.model_id || 'gemini-2.5-flash-image';
        if (modelId === 'gemini-2.0-flash-exp') {
            modelId = 'gemini-2.5-flash-image';
        }

        console.log(`[NanoBanana] Generating content with ${modelId}...`);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const payload = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseModalities: ["image"],
                    imageConfig: {
                        aspectRatio: "16:9"
                    }
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                // If 404, might be model fallback?
                if (response.status === 404 && modelId !== 'gemini-2.5-flash-image') {
                    console.warn(`[NanoBanana] ${modelId} not found, falling back to gemini-2.5-flash-image`);
                    // Simple retry with fallback:
                    return this.run(_run, { ...stage, model_id: 'gemini-2.5-flash-image' }, _attempt, context, prompt);
                }
                throw new Error(`Gemini REST Error ${response.status}: ${errText}`);
            }

            const data: any = await response.json();

            // Extract images
            const artifacts: any[] = [];

            // Response format: candidates[0].content.parts[].inlineData (or executableCode etc)
            const candidates = data.candidates;
            if (candidates && candidates.length > 0) {
                const parts = candidates[0].content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
                        artifacts.push({
                            kind: 'image',
                            slug: `image_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                            data: Buffer.from(part.inlineData.data, 'base64')
                        });
                    }
                }
            }

            if (artifacts.length === 0) {
                throw new Error(`No image parts found in response: ${JSON.stringify(data).substring(0, 200)}`);
            }

            return {
                _artifacts: artifacts,
                summary: `Image generated via ${modelId}`
            };

        } catch (e: any) {
            console.error("[NanoBanana] Error:", e);
            throw e;
        }
    }
}
