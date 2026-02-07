
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

async function purgeRuns() {
    await client.connect();
    console.log("Connected to DB");

    try {
        await client.query('BEGIN');

        console.log("Deleting ALL runs (cascading to stage_runs, run_events)...");
        const res = await client.query("DELETE FROM runs");
        console.log(`Deleted ${res.rowCount} runs.`);

        await client.query('COMMIT');
        console.log("✅ Purge complete.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Purge failed:", e);
    } finally {
        await client.end();
    }
}

purgeRuns().catch(e => console.error(e));
