import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FlowsDb } from '../db/flows';

// --- Validation Schemas ---

const CreateFlowSchema = z.object({
    name: z.string().min(1),
    version_major: z.number().int().min(0),
    version_minor: z.number().int().min(0),
    version_patch: z.number().int().min(0),
    description: z.string().default('')
});

const UpdateFlowSchema = z.object({
    description: z.string().optional(),
    name: z.string().min(1).optional()
});

const UpsertStageSchema = z.object({
    order_index: z.number().int().min(1).optional(),
    kind: z.enum(['llm', 'image', 'model3d', 'code']).optional(),
    provider: z.enum(['openai', 'gemini', 'fal', 'meshy', 'rodin', 'internal']).optional(),
    model_id: z.string().optional(),
    prompt_template: z.string().optional(),
    attachments_policy_json: z.record(z.any()).optional(),
    input_bindings_json: z.record(z.any()).optional(),
    provider_config_json: z.record(z.any()).optional(),
    output_schema_json: z.record(z.any()).optional(),
    breakpoint_after: z.boolean().optional(),
    stage_key: z.string().min(1).regex(/^[A-Z0-9_]+$/, "Stage Key must be uppercase alphanumeric").optional()
});

const StageKeyParamsSchema = z.object({
    flowId: z.string().uuid(),
    stageKey: z.string().min(1).regex(/^[A-Z0-9_]+$/, "Stage Key must be uppercase alphanumeric with underscores")
});

const FlowIdParamsSchema = z.object({
    id: z.string().uuid()
});

// --- Routes ---

export async function designRoutes(server: FastifyInstance) {

    // 1. GET /design/flows
    server.get('/design/flows', async (_req, _reply) => {
        const flows = await FlowsDb.listFlows();
        return { flows };
    });

    // 2. POST /design/flows
    server.post('/design/flows', async (req, reply) => {
        const result = CreateFlowSchema.safeParse(req.body);
        if (!result.success) {
            return reply.code(400).send({ error: "Validation failed", details: result.error.format() });
        }

        try {
            const flow = await FlowsDb.createFlow(result.data);
            return { flow };
        } catch (err: any) {
            if (err.code === '23505') { // Postgres unique violation
                return reply.code(409).send({ error: "Flow version already exists" });
            }
            req.log.error(err);
            return reply.code(500).send({ error: "Internal Error" });
        }
    });

    // 3. PUT /design/flows/:id
    server.put<{ Params: { id: string } }>('/design/flows/:id', async (req, reply) => {
        const paramsResult = FlowIdParamsSchema.safeParse(req.params);
        if (!paramsResult.success) return reply.code(400).send({ error: "Invalid ID" });

        const bodyResult = UpdateFlowSchema.safeParse(req.body);
        if (!bodyResult.success) return reply.code(400).send({ error: "Validation failed" });

        try {
            const flow = await FlowsDb.updateFlow({ id: req.params.id, ...bodyResult.data });
            if (!flow) return reply.code(404).send({ error: "Flow not found" });
            return { flow };
        } catch (err: any) {
            if (err.code === '23505') return reply.code(409).send({ error: "Name conflict" });
            throw err;
        }
    });

    // 4. POST /design/flows/:id/clone
    server.post<{ Params: { id: string } }>('/design/flows/:id/clone', async (req, reply) => {
        const paramsResult = FlowIdParamsSchema.safeParse(req.params);
        if (!paramsResult.success) return reply.code(400).send({ error: "Invalid ID" });

        try {
            const flow = await FlowsDb.cloneFlow(req.params.id);
            if (!flow) return reply.code(404).send({ error: "Source flow not found" });
            return { flow };
        } catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: "Clone failed" });
        }
    });

    // 5. POST /design/flows/:id/publish
    server.post<{ Params: { id: string } }>('/design/flows/:id/publish', async (req, reply) => {
        const paramsResult = FlowIdParamsSchema.safeParse(req.params);
        if (!paramsResult.success) return reply.code(400).send({ error: "Invalid ID" });

        try {
            const flow = await FlowsDb.publishFlow(req.params.id);
            if (!flow) return reply.code(404).send({ error: "Flow not found" });
            return { flow };
        } catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: "Publish failed" });
        }
    });

    // 6. GET /design/flows/:flowId/stages
    server.get<{ Params: { flowId: string } }>('/design/flows/:flowId/stages', async (req, reply) => {
        const result = z.string().uuid().safeParse(req.params.flowId);
        if (!result.success) return reply.code(400).send({ error: "Invalid Flow ID" });

        // Check flow exists first
        const flow = await FlowsDb.getFlowById(req.params.flowId);
        if (!flow) return reply.code(404).send({ error: "Flow not found" });

        const stages = await FlowsDb.listStages(req.params.flowId);
        return { flow_version_id: flow.id, stages };
    });

    // 7. PUT /design/flows/:flowId/stages/:stageKey
    server.put<{ Params: { flowId: string; stageKey: string } }>('/design/flows/:flowId/stages/:stageKey', async (req, reply) => {
        const paramsResult = StageKeyParamsSchema.safeParse(req.params);
        if (!paramsResult.success) return reply.code(400).send({ error: "Invalid Parameters", details: paramsResult.error.format() });

        const bodyResult = UpsertStageSchema.safeParse(req.body);
        if (!bodyResult.success) return reply.code(400).send({ error: "Validation failed", details: bodyResult.error.format() });

        try {
            // Handle Renaming first if needed
            const newKey = bodyResult.data.stage_key;
            let currentKey = req.params.stageKey;

            if (newKey && newKey !== currentKey) {
                await FlowsDb.renameStage(req.params.flowId, currentKey, newKey);
                currentKey = newKey; // Update for upsert lookup
            }

            const stage = await FlowsDb.upsertStage({
                flow_version_id: req.params.flowId,
                stage_key: currentKey,
                ...bodyResult.data
            });
            return { stage };
        } catch (err: any) {
            if (err.message && err.message.includes("Missing required fields")) {
                return reply.code(400).send({ error: err.message });
            }
            if (err.code === '23505') { // Unique conflict
                return reply.code(409).send({ error: "Stage conflict (duplicate order_index or key)" });
            }
            if (err.code === '23503') { // FK violation (flow_id)
                return reply.code(404).send({ error: "Flow not found" });
            }
            req.log.error(err);
            return reply.code(500).send({ error: "Internal Error" });
        }
    });
}
