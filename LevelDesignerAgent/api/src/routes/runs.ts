import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RunsDb, CreateRunParams } from '../db/runs';

export async function runsRoutes(server: FastifyInstance) {
    // List Runs
    server.get('/api/v1/runs', async (req: FastifyRequest<{ Querystring: { limit?: number, offset?: number } }>, _reply: FastifyReply) => {
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
    server.get('/api/v1/runs/:id/stages', async (req: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
        const { id } = req.params;
        const stages = await RunsDb.getStageRuns(id);
        return { stages };
    });

    // Get Run Events
    server.get('/api/v1/runs/:id/events', async (req: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
        const { id } = req.params;
        const events = await RunsDb.getRunEvents(id);
        return { events };
    });

    // Resume Run
    server.post('/api/v1/runs/:id/resume', async (req: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
        const { id } = req.params;
        await RunsDb.resumeRun(id);
        return { success: true };
    });

    // Delete Run
    server.delete('/api/v1/runs/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;
        const deleted = await RunsDb.deleteRun(id);
        if (!deleted) {
            return reply.code(404).send({ error: "Run not found" });
        }
        return { success: true };
    });

    // Download Run Assets (ZIP)
    server.get('/api/v1/runs/:id/download', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;
        const run = await RunsDb.getRunById(id);
        if (!run) return reply.code(404).send({ error: "Run not found" });

        // Collect all assets
        // We need a helper to get assets by run_id, or iterate stages.
        // Let's query assets table directly for now or add helper.
        const { Pool } = await import('pg'); // Lazy load
        const { getDbConfig } = await import('../db/utils');
        const pool = new Pool(getDbConfig(process.env.DATABASE_URL!));

        try {
            const assetRes = await pool.query(`
                SELECT a.id, a.kind, a.slug, f.r2_key 
                FROM assets a
                JOIN asset_files f ON a.id = f.asset_id
                WHERE a.metadata_json->>'source_run_id' = $1
            `, [id]);

            if (assetRes.rows.length === 0) {
                return reply.code(404).send({ error: "No assets found for this run" });
            }

            const archiver = (await import('archiver')).default;
            const archive = archiver('zip', { zlib: { level: 9 } });

            reply.header('Content-Type', 'application/zip');
            reply.header('Content-Disposition', `attachment; filename="run-${id}.zip"`);

            archive.pipe(reply.raw);

            const { getS3Client } = await import('../storage/r2');
            const s3 = await getS3Client();
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            const bucket = process.env.CF_R2_BUCKET_NAME!;

            for (const asset of assetRes.rows) {
                try {
                    const cmd = new GetObjectCommand({ Bucket: bucket, Key: asset.r2_key });
                    const s3Res = await s3.send(cmd);
                    if (s3Res.Body) {
                        // @ts-ignore
                        archive.append(s3Res.Body, { name: `${asset.slug}.${asset.r2_key.split('.').pop()}` });
                    }
                } catch (err) {
                    req.log.error(`Failed to zip asset ${asset.slug}: ${err}`);
                }
            }

            await archive.finalize();
        } finally {
            await pool.end();
        }
    });
}
