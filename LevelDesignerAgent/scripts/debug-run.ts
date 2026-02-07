
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

async function check() {
    await client.connect();
    const runId = '165324e2-f6ad-4f80-993e-878929d7ddef';

    const runRes = await client.query("SELECT * FROM runs WHERE id = $1", [runId]);
    if (runRes.rows.length === 0) {
        console.log("Run not found");
        return;
    }

    const run = runRes.rows[0];
    console.log(`Run ${run.id}:`);
    console.log(`- Flow Version ID: ${run.flow_version_id}`);

    const flowRes = await client.query("SELECT * FROM flow_versions WHERE id = $1", [run.flow_version_id]);
    if (flowRes.rows.length === 0) {
        console.log(`- Flow Version ${run.flow_version_id} NOT FOUND in DB!`);
    } else {
        const flow = flowRes.rows[0];
        console.log(`- Flow: ${flow.name} v${flow.version_major}.${flow.version_minor}.${flow.version_patch}`);

        const stagesRes = await client.query("SELECT count(*) as count FROM flow_stage_templates WHERE flow_version_id = $1", [run.flow_version_id]);
        console.log(`- Stages in Flow: ${stagesRes.rows[0].count}`);
    }

    await client.end();
}

check().catch(e => console.error(e));
