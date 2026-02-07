
// import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

export class NanoBananaProvider implements ProviderAdapter {
    // private client: GoogleGenerativeAI | null = null; // Unused

    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = context._secrets['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in secrets");
        }

        // const genAI = new GoogleGenerativeAI(apiKey);
        // this.client = genAI;

        const modelId = stage.model_id || 'gemini-2.5-flash-image';
        // const model = genAI.getGenerativeModel({ model: modelId });

        console.log(`[NanoBanana] Generating image with ${modelId}...`);

        try {
            // Use REST API directly since SDK generateContent doesn't support Imagen 3 yet
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        instances: [
                            {
                                prompt: prompt,
                            },
                        ],
                        parameters: {
                            sampleCount: 1, // Generate 1 image
                            aspectRatio: "16:9" // Default to landscape, could be dynamic
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data: any = await response.json();

            // Expected format for Imagen:
            // { predictions: [ { bytesBase64Encoded: "..." } ] }
            const predictions = data.predictions;

            if (!predictions || predictions.length === 0) {
                throw new Error("No predictions returned from Google API");
            }

            const artifacts: any[] = [];

            for (const prediction of predictions) {
                if (prediction.bytesBase64Encoded) {
                    const base64 = prediction.bytesBase64Encoded;

                    artifacts.push({
                        kind: 'image',
                        slug: `image_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        data: Buffer.from(base64, 'base64')
                    });
                }
            }

            if (artifacts.length === 0) {
                // Try fallback format just in case (e.g. some versions return different structure)
                throw new Error(`No image data found in response: ${JSON.stringify(data).substring(0, 200)}`);
            }

            return {
                _artifacts: artifacts,
                summary: "Image generated successfully via REST API"
            };

        } catch (e: any) {
            console.error("[NanoBanana] Error:", e);
            throw e;
        }
    }
}
