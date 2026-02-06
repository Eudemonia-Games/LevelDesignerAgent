import { APP_VERSION } from '@lda/shared';
import { runMigrations } from './db/migrations';

console.log(`[Worker] Starting up... Version: ${APP_VERSION}`);

// Run DB migrations
runMigrations().catch(err => {
    console.error("Worker migration failed:", err);
    process.exit(1);
});

setInterval(() => {
    console.log('[Worker] Heartbeat...');
}, 30000);
