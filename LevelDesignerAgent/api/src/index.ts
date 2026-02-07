import path from 'path';
import dotenv from 'dotenv';

// Load .env from root (monorepo context)
dotenv.config({ path: path.join(process.cwd(), '../.env') });
// Also try local .env just in case
dotenv.config();

import { buildServer } from './server';
import { runMigrations } from './db/migrations';
import { seedDefaults } from './db/seed';

const start = async () => {
    console.log(`[API] Starting service... Version: ${process.env.npm_package_version || 'unknown'}`);

    try {
        const server = await buildServer();
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

        // Bind port FIRST to satisfy cloud health checks immediately
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`API server listening on port ${port}`);



        // ... inside start() ...

        // Run migrations in background (non-blocking to startup, but vital for app)
        console.log("[API] Starting DB migrations...");
        runMigrations().then(async () => {
            console.log("[API] Migrations completed.");
            // Run seeding after migrations
            if (process.env.DATABASE_URL) {
                console.log("[API] Starting DB seeding...");
                await seedDefaults();
                console.log("[API] DB seeding completed.");
            }
        }).catch(err => {
            console.error("❌ [API] Critical: Migrations failed:", err);
        });

    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
};

start();
