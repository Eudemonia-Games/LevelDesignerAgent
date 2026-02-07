
export { OpenAIProvider as OpenAIAdapter } from './openai';
export { FalProvider as FalAdapter } from './fal';
export { MeshyProvider as MeshyAdapter } from './meshy';
export { RodinAdapter } from './rodin';
export { GeminiAdapter } from './gemini';

// Alias Provider names if needed for consistency check
import { RodinAdapter } from './rodin';
export const RodinProvider = RodinAdapter;

import { GeminiAdapter } from './gemini';
export const GeminiProvider = GeminiAdapter;

export * from './index';
