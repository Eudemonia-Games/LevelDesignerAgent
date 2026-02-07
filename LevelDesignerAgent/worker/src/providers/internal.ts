import { ProviderAdapter, ProviderOutput } from './index';
import { Run, FlowStageTemplate } from '../db/types';

export class InternalProvider implements ProviderAdapter {
    async run(_run: Run, stage: FlowStageTemplate, _attempt: number, _context: any, _prompt: string): Promise<ProviderOutput> {
        // Internal stages usually just run code in the orchestrator or return simple echoes
        // For now, we just return the prompt as a dummy "code execution" result
        // In real impl, this might dispatch to specific internal handlers based on stage key

        console.log(`[Internal] Executing ${stage.stage_key}`);

        return {
            status: 'success',
            output: {
                message: "Internal stage executed",
                stage_key: stage.stage_key,
                timestamp: new Date().toISOString()
            }
        };
    }
}
