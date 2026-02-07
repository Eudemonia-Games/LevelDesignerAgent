
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import AdmZip from 'adm-zip';
import { RunsDb } from '../db/runs';
import { AssetsDb } from '../db/assets';

export async function exportRoutes(server: FastifyInstance) {

    // GET /api/v1/runs/:id/export
    server.get('/api/v1/runs/:id/export', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = req.params;

        const run = await RunsDb.getRunById(id);
        if (!run) return reply.status(404).send({ error: "Run not found" });

        // Get all assets linked to this run
        // We haven't strictly populated `run_asset_links` in `executeRun` yet (we only emitted events and updated JSON).
        // Phase 9 requirement: Export assets generated in the run.
        // We can look at `produced_artifacts_json` in `stage_runs` OR query `assets` table by metadata `source_run_id`.
        // Let's use `AssetsDb` to find assets by metadata.

        // We need a method in AssetsDb to find by run_id.
        // For now, let's just query `assets` directly via a helper or assume we add `listAssets({ run_id })`.
        // Actually `listAssets` takes generic filters.

        // Let's query assets where metadata->>'source_run_id' = id.
        // Since `listAssets` in `db/assets.ts` might not support arbitrary metadata filter yet, 
        // we might need to add a specialized query here or update `AssetsDb`.
        // Let's implement a specific `getRunAssets` in `export.ts` or extend `AssetsDb` later. 
        // For MVP export, let's do a direct query here if possible, or use `AssetsDb.listAssets`.

        // Let's try `listAssets` filtering if we can, but it was just offset/limit.
        // I will add a method to AssetsDb in a separate step if needed. 
        // For now, let's assume we can add it.

        const assets = await AssetsDb.getAssetsByRunId(id); // Will need to implement this

        const zip = new AdmZip();

        // Manifest
        const manifest = {
            run_id: run.id,
            flow_version_id: run.flow_version_id,
            created_at: run.created_at,
            assets: assets.map(a => ({
                id: a.id,
                kind: a.kind,
                slug: a.slug,
                file: `assets/${a.slug}.${getExtension(a.kind)}`
            }))
        };

        zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));

        // Add Files
        // We need to fetch file content from R2 (or wherever they are). 
        // `asset_files` table has metadata. Content is in R2.
        // BUT `verify_e2e_flow` stubs stored data in R2 simulation? 
        // Actually `createAssetFile` put it in R2.
        // We need to read it back.
        // `AssetsDbService` needs `getAssetFileStream` or `getAssetFileBuffer`.

        for (const asset of assets) {
            // Get file record
            const fileRec = await AssetsDb.getPrimaryFile(asset.id);
            if (!fileRec) continue;

            // Get content
            const buffer = await AssetsDb.getFileBuffer(fileRec.r2_key); // Need implement
            if (buffer) {
                const ext = getExtension(asset.kind);
                zip.addFile(`assets/${asset.slug}.${ext}`, buffer);
            }
        }

        const zipBuffer = zip.toBuffer();

        reply.header('Content-Type', 'application/zip');
        reply.header('Content-Disposition', `attachment; filename="run_${id}.zip"`);
        return reply.send(zipBuffer);
    });

    // GET /api/v1/runs/:id/manifest
    server.get('/api/v1/runs/:id/manifest', async (req: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
        const { id } = req.params;
        const assets = await AssetsDb.getAssetsByRunId(id);
        const manifest = {
            run_id: id,
            assets: assets.map(a => ({
                id: a.id,
                kind: a.kind,
                slug: a.slug,
                url: `/api/v1/assets/${a.id}/file` // Virtual URL
            }))
        };
        return manifest;
    });
}

function getExtension(kind: string): string {
    if (kind.includes('image')) return 'png'; // or jpg
    if (kind.includes('model_source')) return 'glb';
    if (kind.includes('text') || kind.includes('json')) return 'json';
    return 'bin';
}
