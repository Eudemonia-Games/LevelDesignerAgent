
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
}

const client = new Client(dbUrl);

async function cleanup() {
    await client.connect();
    console.log("Connected to DB");

    // 1. Identify flows to delete
    const res = await client.query("SELECT id, name FROM flow_versions WHERE name != 'bossroom_default'");
    const flowIds = res.rows.map(r => r.id);

    if (flowIds.length === 0) {
        console.log("No flows to delete.");
        await client.end();
        return;
    }

    console.log(`Found ${flowIds.length} flows to delete: ${res.rows.map(r => r.name).join(', ')}`);

    try {
        await client.query('BEGIN');

        // 2. Delete dependent RUNS first
        console.log(`Deleting dependent runs...`);
        const delRunsRes = await client.query("DELETE FROM runs WHERE flow_version_id = ANY($1::uuid[])", [flowIds]);
        console.log(`Deleted ${delRunsRes.rowCount} runs.`);

        // 3. Delete dependent STAGE RUNS (cascaded from runs usually, but good to check if configured)
        // If 'runs' deletion cascades to 'stage_runs', then done. If not, explicit delete might be needed.
        // Assuming ON DELETE CASCADE on foreign keys for stage_runs -> runs.

        // 4. Delete dependent STAGE TEMPLATES
        console.log(`Deleting dependent stage templates...`);
        const delStagesRes = await client.query("DELETE FROM flow_stage_templates WHERE flow_version_id = ANY($1::uuid[])", [flowIds]);
        console.log(`Deleted ${delStagesRes.rowCount} stage templates.`);

        // 5. Delete FLOW VERSIONS
        console.log(`Deleting flow versions...`);
        const delFlowsRes = await client.query("DELETE FROM flow_versions WHERE id = ANY($1::uuid[])", [flowIds]);
        console.log(`Deleted ${delFlowsRes.rowCount} flow versions.`);

        await client.query('COMMIT');
        console.log("✅ Cleanup complete.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Cleanup failed:", e);
    } finally {
        await client.end();
    }
}

cleanup().catch(e => console.error(e));
