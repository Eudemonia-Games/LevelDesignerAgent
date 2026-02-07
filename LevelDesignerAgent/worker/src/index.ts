import { APP_VERSION } from '@lda/shared';
import { runMigrations } from './db/migrations';

console.log(`[Worker] Starting up... Version: ${APP_VERSION}`);

// Run DB migrations
runMigrations().catch(err => {
    // Sanitized config for migration check
    let connectionString = process.env.DATABASE_URL || '';
    if (connectionString && connectionString.includes("channel_binding")) {
        connectionString = connectionString.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }
    console.error("Worker migration failed:", err);
    process.exit(1);
});

setInterval(() => {
    console.log('[Worker] Heartbeat...');
}, 30000);
