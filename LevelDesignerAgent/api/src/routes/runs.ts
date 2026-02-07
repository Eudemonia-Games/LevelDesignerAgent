import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RunsDb, CreateRunParams } from '../db/runs';

export async function runsRoutes(server: FastifyInstance) {
    // List Runs
    server.get('/api/v1/runs', async (req: FastifyRequest<{ Querystring: { limit?: number, offset?: number } }>, reply: FastifyReply) => {
        const runs = await RunsDb.listRuns(req.query);
        return { runs };
    });

    // Create Run
    server.post('/api/v1/runs', async (req: FastifyRequest<{ Body: CreateRunParams }>, reply: FastifyReply) => {
        const params = req.body;

        // Basic validation
        if (!params.flow_version_id || !params.user_prompt) {
            return reply.code(400).send({ error: "Missing flow_version_id or user_prompt" });
        }
        if (params.mode !== 'express' && params.mode !== 'custom') {
            return reply.code(400).send({ error: "Invalid mode (must be express or custom)" });
        }

        const run = await RunsDb.createRun(params);
        return { run };
    });

    // Get Run
    server.get('/api/v1/runs/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;
        const run = await RunsDb.getRunById(id);
        if (!run) {
            return reply.code(404).send({ error: "Run not found" });
        }
        return { run };
    });

    // Get Stage Runs
    server.get('/api/v1/runs/:id/stages', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;
        const stages = await RunsDb.getStageRuns(id);
        return { stages };
    });

    // Get Run Events
    server.get('/api/v1/runs/:id/events', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;
        const events = await RunsDb.getRunEvents(id);
        return { events };
    });

    // Resume Run
    server.post('/api/v1/runs/:id/resume', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;
        await RunsDb.resumeRun(id);
        return { success: true };
    });
}
