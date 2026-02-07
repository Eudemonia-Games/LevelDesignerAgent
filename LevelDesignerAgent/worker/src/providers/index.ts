import { FlowStageTemplate, Run } from '../db/types';

export interface ProviderOutput {
    [key: string]: any;
    _artifacts?: {
        kind: string;
        slug: string;
        data: any; // Buffer or string
    }[];
}

export interface ProviderAdapter {
    run(run: Run, stage: FlowStageTemplate, attempt: number, context: any, prompt: string): Promise<ProviderOutput>;
}

const registry = new Map<string, ProviderAdapter>();

export function registerProvider(id: string, adapter: ProviderAdapter) {
    registry.set(id, adapter);
}

export function getProvider(id: string): ProviderAdapter {
    const adapter = registry.get(id);
    if (!adapter) {
        throw new Error(`Provider ${id} not found`);
    }
    return adapter;
}
