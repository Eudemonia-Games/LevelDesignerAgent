
import { Client } from "pg";
import { SCHEMA_SQL } from "./schemaSql";

// Helper for retry
async function connectWithRetry(client: Client, retries = 5, delay = 2000): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[DB] Attempting connection (try ${i + 1}/${retries})...`);
            await client.connect();
            console.log("✅ [DB] Connected successfully.");
            return;
        } catch (err: any) {
            console.error(`❌ [DB] Connection failed (try ${i + 1}/${retries}): ${err.message}`);
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay * (i + 1))); // Linear backoff
        }
    }
}

export async function runMigrations() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.warn("⚠️ [DB] DATABASE_URL not set. Skipping migrations.");
        return;
    }

    // Masked log for debugging
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
    console.log(`[DB] Using DATABASE_URL: ${maskedUrl}`);

    // Sanitizer: Remove channel_binding if present
    let connectionString = dbUrl;
    if (dbUrl.includes("channel_binding")) {
        console.warn("⚠️ [DB] URL contained unsupported param: channel_binding (ignored)");
        connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    console.log(`db:migrate start`);

    const client = new Client({
        connectionString,
        ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000, // 10s timeout per attempt
    });

    try {
        await connectWithRetry(client);

        // Run migrations
        await client.query("BEGIN");
        await client.query(SCHEMA_SQL);
        await client.query("COMMIT");

        console.log("✅ [DB] Migrations applied successfully.");
    } catch (err) {
        // Rollback only if connected and in transaction (safeguard)
        try { await client.query("ROLLBACK"); } catch (e) { }
        console.error("❌ [DB] Migration process failed:", err);
        throw err; // Propagate to index.ts to exit process
    } finally {
        await client.end();
    }
}
