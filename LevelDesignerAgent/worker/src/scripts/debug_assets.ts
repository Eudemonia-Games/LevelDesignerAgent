
import { getPool } from '../db/jobs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from worker root (assuming script is in src/scripts)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RUN_ID = process.argv[2];

if (!RUN_ID) {
    console.error("Please provide a RUN_ID");
    process.exit(1);
}

async function checkAssets() {
    const pool = getPool();

    console.log(`Checking assets for Run ID: ${RUN_ID}`);

    // 1. Check Stage Runs for this Run to see if they have artifact links
    const stageRunsRes = await pool.query(`
        SELECT stage_key, status, produced_artifacts_json 
        FROM stage_runs 
        WHERE run_id = $1 
        ORDER BY created_at ASC
    `, [RUN_ID]);

    console.log("\n--- Stage Runs ---");
    stageRunsRes.rows.forEach(row => {
        console.log(`[${row.stage_key}] Status: ${row.status}`);
        console.log(`  Artifacts: ${JSON.stringify(row.produced_artifacts_json)}`);
    });

    // 2. Check Assets table manually (metadata_json->>source_run_id)
    console.log("\n--- Assets (via metadata) ---");
    const assetsRes = await pool.query(`
        SELECT a.id, a.kind, a.slug, af.r2_key, af.mime_type
        FROM assets a
        LEFT JOIN asset_files af ON a.id = af.asset_id
        WHERE a.metadata_json->>'source_run_id' = $1
    `, [RUN_ID]);

    if (assetsRes.rows.length === 0) {
        console.log("No assets found linked to this run in metadata.");
    } else {
        assetsRes.rows.forEach(row => {
            console.log(`Asset ID: ${row.id}`);
            console.log(`  Kind: ${row.kind}`);
            console.log(`  Slug: ${row.slug}`);
            console.log(`  R2 Key: ${row.r2_key}`);
            console.log(`  Mime: ${row.mime_type}`);
            console.log("---------------------------------------------------");
        });
    }

    process.exit(0);
}

checkAssets().catch(err => {
    console.error(err);
    process.exit(1);
});
