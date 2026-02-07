import { APP_VERSION } from '@lda/shared';
import { runMigrations } from './db/migrations';

import { startPoller } from './orchestrator/poller';

console.log(`[Worker] Starting up... Version: ${APP_VERSION}`);

// Run DB migrations
runMigrations().then(() => {
    startPoller();
}).catch(err => {
    // Sanitized config for migration check
    let connectionString = process.env.DATABASE_URL || '';
    if (connectionString && connectionString.includes("channel_binding")) {
        connectionString = connectionString.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }
    console.error("Worker migration failed:", err);
    process.exit(1);
});

