
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
    console.log("Connected to DB");

    const flowRes = await client.query("SELECT * FROM flow_versions");
    console.log(`Found ${flowRes.rows.length} flow versions:`);

    for (const flow of flowRes.rows) {
        console.log(`- [${flow.id}] ${flow.name} v${flow.version_major}.${flow.version_minor}.${flow.version_patch} (${flow.is_published ? 'Published' : 'Draft'})`);

        const stageRes = await client.query("SELECT count(*) as count FROM flow_stage_templates WHERE flow_version_id = $1", [flow.id]);
        console.log(`  Stages: ${stageRes.rows[0].count}`);

        const stages = await client.query("SELECT stage_key, kind, provider, model_id FROM flow_stage_templates WHERE flow_version_id = $1 ORDER BY order_index", [flow.id]);
        if (stages.rows.length > 0) {
            console.log(`  First 3 Stages: ${stages.rows.slice(0, 3).map(s => s.stage_key).join(', ')}...`);
        }
    }

    await client.end();
}

check().catch(e => console.error(e));
