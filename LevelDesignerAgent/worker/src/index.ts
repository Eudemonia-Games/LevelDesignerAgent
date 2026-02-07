import { APP_VERSION } from '@lda/shared';
import { runMigrations } from './db/migrations';

import { startPoller } from './orchestrator/poller';

console.log(`[Worker] Starting up... Version: ${APP_VERSION}`);

import * as http from 'http';

// Run DB migrations
runMigrations().then(() => {
    startPoller();

    // Start a dummy HTTP server to satisfy Render Web Service health checks
    const port = process.env.PORT || 8080;
    const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        if (req.url === '/health') {
            res.writeHead(200);
            res.end('ok');
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(port, () => {
        console.log(`[Worker] Health check server listening on port ${port}`);
    });

}).catch(err => {
    // Sanitized config for migration check
    let connectionString = process.env.DATABASE_URL || '';
    if (connectionString && connectionString.includes("channel_binding")) {
        connectionString = connectionString.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }
    console.error("Worker migration failed:", err);
    process.exit(1);
});

