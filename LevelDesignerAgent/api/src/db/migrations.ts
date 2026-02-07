
import { Client } from "pg";
import { SCHEMA_SQL } from "./schemaSql";

export async function runMigrations() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.warn("⚠️ [DB] DATABASE_URL not set. Skipping migrations.");
        return;
    }

    // Sanitizer: Remove channel_binding if present (Node pg doesn't support it well)
    let connectionString = dbUrl;
    if (dbUrl.includes("channel_binding")) {
        console.warn("⚠️ [DB] URL contained unsupported param: channel_binding (ignored)");
        connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    console.log(`Running migrations...`);

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
        await client.query("BEGIN");
        await client.query(SCHEMA_SQL);
        await client.query("COMMIT");

        console.log("✅ [DB] Migrations applied successfully.");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ [DB] Migration failed:", err);
        process.exit(1); // Exit if critical DB setup fails
    } finally {
        await client.end();
    }
}
