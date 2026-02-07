import { safeEval } from './safeEval';
import {
    getRunStages, getLatestStageRuns, createStageRun,
    updateStageRunSuccess, updateStageRunFailure,
    updateRunStatus, updateRunContext, emitRunEvent
} from '../db/jobs';
import { Run, FlowStageTemplate, StageRun } from '../db/types';
// import { generateStubOutput } from './stubs'; // REMOVED
import { getProvider, registerProvider } from '../providers';
import { OpenAIProvider } from '../providers/openai';
import { FalProvider } from '../providers/fal';
import { MeshyProvider } from '../providers/meshy';
import { NanoBananaProvider } from '../providers/nanobanana';

// Registry setup (should be in app startup, but lazy here works for worker)
registerProvider('openai', new OpenAIProvider());
registerProvider('fal', new FalProvider());
registerProvider('meshy', new MeshyProvider());
registerProvider('rodin', new MeshyProvider()); // Alias for now or implement separate
registerProvider('nanobanana', new NanoBananaProvider());
// Register others later or import a bootstrap file

import { buildRunContext } from './context';
import { resolvePrompt, resolveBindings } from './resolver';
import { createAsset, createAssetFile } from '../db/assets';

export async function executeRun(run: Run) {
    // 1. Load Templates
    const templates = await getRunStages(run.flow_version_id);
    if (templates.length === 0) {
        await updateRunStatus(run.id, 'failed', { error_summary: 'No stage templates found' });
        await emitRunEvent(run.id, 'error', 'No stage templates found for flow version');
        return;
    }

    // 2. Load History
    const stageRuns = await getLatestStageRuns(run.id);
    const historyMap = new Map<string, StageRun>();
    stageRuns.forEach(sr => historyMap.set(sr.stage_key, sr));

    // 3. Determine Next Stage
    let nextStage: FlowStageTemplate | null = null;
    let attempt = 1;

    // Helper to find stage by key
    const getStageByKey = (key: string) => templates.find(t => t.stage_key === key);

    // Initial check: if no history, start with first stage (lowest order_index)
    if (stageRuns.length === 0) {
        if (templates.length > 0) {
            nextStage = templates[0]; // Assumes templates sorted by order_index
            attempt = 1;
        }
    } else {
        // We have history. Find the "frontier".
        // In a linear non-branching flow, we look for the last successful stage and go to next order.
        // In branching, we look at the last *executed* stage (by time or graph traversal).

        // Find the most recently updated stage run
        const recentRun = stageRuns.sort((a, b) => {
            const tA = new Date(a.ended_at || a.started_at || 0).getTime();
            const tB = new Date(b.ended_at || b.started_at || 0).getTime();
            return tB - tA; // DESC
        })[0];

        if (recentRun) {
            const tmpl = getStageByKey(recentRun.stage_key);
            if (!tmpl) {
                // Stage template deleted?
                return;
            }

            if (recentRun.status === 'running') {
                // Check stuck/recovery
                await emitRunEvent(run.id, 'warn', `Recovering stuck running stage ${tmpl.stage_key}`);
                nextStage = tmpl;
                attempt = recentRun.attempt + 1;
            } else if (recentRun.status === 'failed') {
                // Fail run
                await updateRunStatus(run.id, 'failed', { error_summary: `Stage ${tmpl.stage_key} failed` });
                return;
            } else if (recentRun.status === 'succeeded' || recentRun.status === 'skipped') {
                // Move forward!
                // CHECK ROUTING RULES FIRST
                let routedKey: string | null = null;

                if (tmpl.routing_rules_json && Array.isArray(tmpl.routing_rules_json)) {
                    // Evaluate rules in priority order (assuming array order is priority)
                    for (const rule of tmpl.routing_rules_json) {
                        // Build context for eval. 
                        const evalContext = {
                            context: run.context_json.context || {},
                            inputs: run.context_json.inputs || {},
                            meta: {
                                last_output: recentRun.output_json
                            }
                        };

                        if (safeEval(rule.condition_expression, evalContext)) {
                            routedKey = rule.next_stage_key;
                            await emitRunEvent(run.id, 'info', `Routing rule matched: ${rule.condition_expression} -> ${routedKey}`);
                            break;
                        }
                    }
                }

                if (routedKey) {
                    nextStage = getStageByKey(routedKey) || null;
                    if (!nextStage) {
                        await emitRunEvent(run.id, 'error', `Routed to missing stage: ${routedKey}`);
                        return;
                    }
                    attempt = 1;
                } else {
                    // No routing or no match -> Default to next linear stage (by order)
                    const nextLinear = templates.find(t => t.order_index > tmpl.order_index);
                    nextStage = nextLinear || null;
                    attempt = 1;
                }
            }
        }
    }

    if (!nextStage) {
        // All stages succeeded
        await updateRunStatus(run.id, 'succeeded', {
            current_stage_key: null,
            waiting_for_stage_key: null
        });
        await emitRunEvent(run.id, 'info', 'Run succeeded');
        return;
    }

    // 4. Create/Advance StageRun

    // 4.1 Fetch Secrets
    const { SecretsService } = await import('../db/secrets');
    const secretsMap: Record<string, string> = {};

    // Determine which secrets are needed based on provider
    const provider = nextStage.provider;
    console.log(`[Worker] Fetching secrets for provider: ${provider}, kind: ${nextStage.kind}`);

    if (provider === 'openai') {
        const key = await SecretsService.getDecryptedSecret('OPENAI_API_KEY');
        if (key) secretsMap['OPENAI_API_KEY'] = key;
    } else if (provider === 'gemini') {
        const key = await SecretsService.getDecryptedSecret('GEMINI_API_KEY');
        if (key) secretsMap['GEMINI_API_KEY'] = key;
    } else if (provider === 'fal') {
        const key = await SecretsService.getDecryptedSecret('FAL_API_KEY');
        if (key) secretsMap['FAL_API_KEY'] = key;
    } else if (provider === 'meshy' || provider === 'rodin') {
        const key = await SecretsService.getDecryptedSecret('MESHY_API_KEY');
        if (key) {
            secretsMap['MESHY_API_KEY'] = key;
            console.log("[Worker] Loaded MESHY_API_KEY from secrets");
        } else {
            console.warn("[Worker] MESHY_API_KEY not found in secrets");
        }
    }

    // Build Context
    const context = buildRunContext(run, stageRuns);
    // Inject secrets into context (hidden property convention)
    // Inject secrets into context (hidden property convention)
    (context as any)._secrets = secretsMap;

    // Resolve Bindings
    // This allows remapping "$.context.Stage.output" -> "enhanced_prompt"
    let boundContext = { ...context };
    if (nextStage.input_bindings_json) {
        try {
            const bindings = resolveBindings(nextStage.input_bindings_json, context);
            // Merge bindings at root level for template access: {{variable}}
            boundContext = { ...boundContext, ...bindings };
        } catch (e: any) {
            console.warn(`[Worker] Failed to resolve bindings for ${nextStage.stage_key}:`, e);
        }
    }

    // Resolve Prompt
    let resolvedPrompt = "";
    try {
        resolvedPrompt = resolvePrompt(nextStage.prompt_template, boundContext);
    } catch (e: any) {
        await updateRunStatus(run.id, 'failed', { error_summary: `Prompt resolution failed for ${nextStage.stage_key}: ${e.message}` });
        await emitRunEvent(run.id, 'error', `Prompt resolution failed: ${e.message}`, { stage_key: nextStage.stage_key });
        return;
    }

    const sr = await createStageRun(run.id, nextStage.stage_key, attempt, resolvedPrompt, context);

    // 5. Update Run State
    await updateRunStatus(run.id, 'running', { current_stage_key: nextStage.stage_key });
    await emitRunEvent(run.id, 'info', 'Stage started', {
        stage_key: nextStage.stage_key,
        attempt,
        kind: nextStage.kind,
        provider: nextStage.provider
    });

    try {
        // 6. Execute (Real Provider)
        let output: any;
        try {
            let providerName = nextStage.provider;
            // Dispatch 'gemini' image stages to 'nanobanana'
            if (providerName === 'gemini' && nextStage.kind === 'image') {
                providerName = 'nanobanana';
            }

            const provider = getProvider(providerName);
            output = await provider.run(run, nextStage, attempt, context, resolvedPrompt);
        } catch (e: any) {
            const msg = e.message.toLowerCase();
            const shouldFallback =
                msg.includes('not configured') ||
                msg.includes('not found') ||
                msg.includes('404') ||
                msg.includes('400') ||
                msg.includes('500') ||
                msg.includes('generatecontent') || // Specific to Gemini misuse 
                msg.includes('fetch failed');

            if (shouldFallback) {
                // Fallback to stub if provider missing/unconfigured or API error
                await emitRunEvent(run.id, 'warn', `Provider ${nextStage.provider} failed: ${e.message}. Falling back to STUB.`);
                const { generateStubOutput } = await import('./stubs');
                output = generateStubOutput(run, nextStage, attempt);
            } else {
                throw e;
            }
        }


        // 7. Persist Success

        // Handle Artifacts
        const producedArtifacts = [];
        if (output._artifacts && Array.isArray(output._artifacts)) {
            for (const art of output._artifacts) {
                try {
                    // Create Asset
                    const assetId = await createAsset({
                        kind: art.kind,
                        slug: art.slug,
                        provider: nextStage.provider,
                        model_id: nextStage.model_id,
                        prompt_text: resolvedPrompt, // Use resolved prompt as source
                        metadata_json: { source_run_id: run.id, stage_key: nextStage.stage_key }
                    });

                    // Upload File
                    // art.data is string or buffer.
                    await createAssetFile(assetId, art.data, art.kind);

                    producedArtifacts.push(assetId);

                    await emitRunEvent(run.id, 'info', `Artifact created: ${art.slug}`, { asset_id: assetId });
                } catch (err: any) {
                    await emitRunEvent(run.id, 'error', `Failed to upload artifact ${art.slug}`, { error: err.message });
                }
            }
        }

        // Sanitize output to prevent OOM (remove large binary artifacts)
        const sanitizedOutput = { ...output };
        delete sanitizedOutput._artifacts;

        await updateStageRunSuccess(sr.id, sanitizedOutput, producedArtifacts);
        await emitRunEvent(run.id, 'info', 'Stage succeeded', { stage_key: nextStage.stage_key });

        // 8. Update Context
        // Safe update of JSON context
        const newContext = { ...run.context_json };
        if (!newContext.context) newContext.context = {};

        newContext.context[nextStage.stage_key] = {
            output: sanitizedOutput,
            artifacts: producedArtifacts
        };
        await updateRunContext(run.id, newContext);

        // 9. Handle Breakpoints
        if (run.mode === 'custom' && nextStage.breakpoint_after) {
            await updateRunStatus(run.id, 'waiting_user', {
                waiting_for_stage_key: nextStage.stage_key,
                waiting_reason: 'breakpoint_after',
                current_stage_key: null
            });
            await emitRunEvent(run.id, 'info', 'Paused for user breakpoint', { stage_key: nextStage.stage_key });
            return; // Stop execution loop
        }

        // 10. Recursively continue?
        // Loop by recursive call (tail recursion typically optimized or stack depth limits apply, but ok for now)
        run.context_json = newContext;
        await executeRun(run);

    } catch (e: any) {
        // Handle Failure
        console.error(`Stage ${nextStage.stage_key} execution failed:`, e);
        await updateStageRunFailure(sr.id, {
            message: e.message,
            name: e.name,
            stack: e.stack ? e.stack.substring(0, 1000) : undefined
        });
        await updateRunStatus(run.id, 'failed', { error_summary: e.message });
        await emitRunEvent(run.id, 'error', 'Stage failed', {
            stage_key: nextStage.stage_key,
            error: e.message
        });
    }
}
