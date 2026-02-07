import { TestProviderRequest, TestProviderResult } from '@lda/shared';
import { OpenAIAdapter, GeminiAdapter, FalAdapter, MeshyAdapter, RodinAdapter } from '../providers/adapters';

// This function processes the test_provider_call job
export async function processTestProviderJob(job: { id: string, payload: TestProviderRequest }): Promise<TestProviderResult> {
    const { provider, prompt, model, options } = job.payload;
    console.log(`[Job ${job.id}] Testing provider: ${provider} with model: ${model || 'default'}`);

    try {
        let resultData: any = null;

        switch (provider) {
            case 'openai':
                resultData = await OpenAIAdapter.getInstance().generateText(prompt, model, options);
                break;
            case 'gemini':
                resultData = await GeminiAdapter.getInstance().generateText(prompt, model, options);
                break;
            case 'fal':
                resultData = await FalAdapter.getInstance().generateImage(prompt, model, options);
                break;
            case 'meshy':
                resultData = await MeshyAdapter.getInstance().generate3D(prompt, options);
                break;
            case 'rodin':
                resultData = await RodinAdapter.getInstance().generate3D(prompt);
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }

        return {
            success: true,
            data: resultData
        };

    } catch (e: any) {
        console.error(`[Job ${job.id}] Provider test failed:`, e);
        return {
            success: false,
            error: e.message
        };
    }
}
