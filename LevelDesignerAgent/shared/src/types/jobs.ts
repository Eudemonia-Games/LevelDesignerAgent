export type JobType = 'execute_run' | 'test_provider_call';

export interface TestProviderRequest {
    provider: 'openai' | 'gemini' | 'fal' | 'meshy' | 'rodin';
    model?: string;
    prompt: string;
    options?: any;
}

export interface TestProviderResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface JobPayload {
    type: JobType;
    payload: any;
}
