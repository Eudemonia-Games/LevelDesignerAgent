import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSecret } from '../db/secrets';

export interface GeminiProviderOptions {
    jsonMode?: boolean;
}

export class GeminiAdapter {
    private client: GoogleGenerativeAI | null = null;
    private static instance: GeminiAdapter | null = null;

    private constructor() { }

    static getInstance(): GeminiAdapter {
        if (!GeminiAdapter.instance) {
            GeminiAdapter.instance = new GeminiAdapter();
        }
        return GeminiAdapter.instance;
    }

    private async getClient(): Promise<GoogleGenerativeAI> {
        if (this.client) return this.client;

        const apiKey = await getSecret("GEMINI_API_KEY");
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in secrets");
        }

        this.client = new GoogleGenerativeAI(apiKey);
        return this.client;
    }

    async generateText(prompt: string, modelName: string = "gemini-2.0-flash", options: GeminiProviderOptions = {}): Promise<string> {
        const client = await this.getClient();

        try {
            const model = client.getGenerativeModel({
                model: modelName,
                generationConfig: options.jsonMode ? { responseMimeType: "application/json" } : undefined
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();

        } catch (error: any) {
            console.error("Gemini API Error:", error);
            throw new Error(`Gemini generation failed: ${error.message}`);
        }
    }
}
