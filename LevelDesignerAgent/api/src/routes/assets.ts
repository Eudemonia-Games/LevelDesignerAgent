import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSignedDownloadUrl } from '../storage/r2';
import { AssetsDb } from '../db/assets';

export async function assetsRoutes(server: FastifyInstance) {
    // List Assets
    server.get('/api/v1/assets', async (req: FastifyRequest<{ Querystring: { limit?: number, offset?: number, kind?: string } }>, reply: FastifyReply) => {
        // We need to implement listAssets in AssetsDb
        const assets = await AssetsDb.listAssets(req.query);
        return { assets };
    });

    server.get('/api/v1/assets/:id/url', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;

        // In a real app we might check if user has access to this asset via run_asset_links -> run -> user
        // But for now, if they are admin authenticated (global middleware), they can see any asset.

        // We need to fetch the R2 key from the DB?
        // Wait, the client only knows the Asset ID. 
        // We need to look up `asset_files` for this asset.

        // We need a DB helper here.
        // Let's query directly for now or add a db helper.
        // Direct query is fine for this single endpoint.
        const { Pool } = await import('pg');
        const { getDbConfig } = await import('../db/utils');

        if (!process.env.DATABASE_URL) throw new Error("DB not configured");
        const pool = new Pool(getDbConfig(process.env.DATABASE_URL));

        const res = await pool.query(`
            SELECT r2_key 
            FROM asset_files 
            WHERE asset_id = $1 
            LIMIT 1
        `, [id]);

        if (res.rows.length === 0) {
            return reply.code(404).send({ error: 'Asset file not found' });
        }

        const key = res.rows[0].r2_key;

        try {
            const url = await getSignedDownloadUrl(key);
            return { url };
        } catch (e: any) {
            req.log.error(e);
            return reply.code(500).send({ error: 'Failed to generate URL' });
        }
    });
}
