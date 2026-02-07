import { TestProviderRequest, TestProviderResult } from '@lda/shared';
import { OpenAIAdapter, FalAdapter, MeshyAdapter } from '../providers/adapters';

// This function processes the test_provider_call job
export async function processTestProviderJob(job: { id: string, payload: TestProviderRequest }): Promise<TestProviderResult> {
    const { provider, prompt, model, options } = job.payload;
    console.log(`[Job ${job.id}] Testing provider: ${provider} with model: ${model || 'default'}`);

    try {
        let resultData: any = null;

        switch (provider) {
            case 'openai':
                resultData = await new OpenAIAdapter().generateText(prompt, model, options);
                break;
            case 'gemini':
                // Gemini uses OpenAIAdapter with specific config
                resultData = await new OpenAIAdapter({
                    apiKeyName: 'GEMINI_API_KEY',
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
                }).generateText(prompt, model, options);
                break;
            case 'fal':
                resultData = await FalAdapter.getInstance().generateImage(prompt, model, options);
                break;
            case 'meshy':
                resultData = await MeshyAdapter.getInstance().generate3D(prompt, options);
                break;
            case 'rodin':
                throw new Error("Rodin provider not yet implemented");
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
