
import { Client } from "pg";
import { SCHEMA_SQL } from "./schemaSql";

export async function runMigrations() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.warn("⚠️ [DB] DATABASE_URL not set. Skipping migrations.");
        return;
    }

    // Sanitizer: Remove channel_binding if present
    let connectionString = dbUrl;
    if (dbUrl.includes("channel_binding")) {
        connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    // Explicitly NO logging of the URL
    console.log(`db:migrate start`);

    const client = new Client({
        connectionString,
        ssl: connectionString.includes("localhost")
            ? false
            : { rejectUnauthorized: false }, // Neon usually requires SSL
    });

    try {
        await client.connect();

        // Using a simple idempotent approach: running the full schema SQL.
        // The schema SQL uses IF NOT EXISTS and DO blocks to handle idempotency.
        // Note: worker usually doesn't need to run migrations if API does, but consistent redundancy is okay.
        // Or we could skip it in worker if we prefer. The plan said to include it.
        await client.query("BEGIN");
        await client.query(SCHEMA_SQL);
        await client.query("COMMIT");

        console.log("db:migrate success");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("db:migrate error:", (err as any).message);
        process.exit(1); // Exit if critical DB setup fails
    } finally {
        await client.end();
    }
}
