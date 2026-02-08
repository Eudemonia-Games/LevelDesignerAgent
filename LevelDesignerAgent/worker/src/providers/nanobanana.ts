import { ProviderAdapter, ProviderOutput } from './index';
import { FlowStageTemplate, Run } from '../db/types';

type GeminiInlineImage = {
    inlineData: { mimeType?: string; data: string };
};

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

// function normalizeModelId(modelId: string | undefined): string { ... } // Removed


async function callGenerateContent(apiKey: string, modelId: string, prompt: string) {
    console.log(`[NanoBanana] Generating prompt (len=${prompt.length}): ${prompt.slice(0, 100)}...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            // Ask explicitly for image output when supported
            responseModalities: ['image'], // Note: API expects lowercase 'image' usually, checking docs
            // Some models ignore this; harmless if unsupported
            imageConfig: { aspectRatio: '16:9' }
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const text = await resp.text();
    if (!resp.ok) {
        // Bubble up raw details for debugging
        throw new Error(`Gemini generateContent failed (${resp.status} ${resp.statusText}) for model ${modelId}: ${text}`);
    }

    return JSON.parse(text);
}

export class NanoBananaProvider implements ProviderAdapter {
    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, context: any, prompt: string): Promise<ProviderOutput> {
        const apiKey = context._secrets?.['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not found in secrets');
        }

        // Preferred + fallback model list
        // const requested = normalizeModelId(stage.model_id); // Unused
        const candidates = ['gemini-2.5-flash-image'];

        console.log(`[NanoBanana] Generating image. Requested=${stage.model_id || '(none)'} Using candidates=${candidates.join(', ')}`);

        let lastErr: any = null;
        for (const modelId of candidates) {
            try {
                const json = await callGenerateContent(apiKey, modelId, prompt);

                const cand = json?.candidates?.[0];
                const parts: GeminiInlineImage[] = cand?.content?.parts || [];
                const artifacts: any[] = [];

                for (const part of parts) {
                    if (part && (part as any).inlineData?.data) {
                        const inline = (part as any).inlineData;
                        const mimeType = inline.mimeType || 'image/png';
                        const base64 = inline.data;

                        artifacts.push({
                            kind: 'image',
                            file_kind: 'png',
                            mime_type: mimeType,
                            file_ext: mimeType.includes('png') ? 'png' : 'bin',
                            slug: `image_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                            data: Buffer.from(base64, 'base64')
                        });
                    }
                }

                if (artifacts.length === 0) {
                    const maybeText = cand?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') || '';
                    console.error("[NanoBanana] Raw Response:", JSON.stringify(json, null, 2));
                    throw new Error(`No inline images returned from ${modelId}. Text=${maybeText.slice(0, 500)}`);
                }

                return {
                    used_model: modelId,
                    summary: `Image generated via Gemini (${modelId})`,
                    _artifacts: artifacts
                };

            } catch (e: any) {
                lastErr = e;
                const msg = (e?.message || '').toLowerCase();
                const retryable = msg.includes('404') || msg.includes('not supported') || msg.includes('not found') || msg.includes('permission');
                console.warn(`[NanoBanana] Model ${modelId} failed: ${e?.message}`);
                if (retryable) {
                    // Try next model quickly
                    await sleep(150);
                    continue;
                }
                // Non-retryable -> stop
                throw e;
            }
        }

        throw lastErr || new Error('NanoBananaProvider failed: no models succeeded');
    }
}
