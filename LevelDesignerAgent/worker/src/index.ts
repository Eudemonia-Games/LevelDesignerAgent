import { APP_VERSION } from '@lda/shared';
import { runMigrations } from './db/migrations';

import { startPoller } from './orchestrator/poller';

console.log(`[Worker] Starting up... Version: ${APP_VERSION}`);

import * as http from 'http';

// Register Providers
import { registerProvider } from './providers';
import { OpenAIProvider } from './providers/openai';
import { FalProvider } from './providers/fal';
import { MeshyProvider } from './providers/meshy';
import { InternalProvider } from './providers/internal';
import { GeminiProvider } from './providers/gemini';

registerProvider('openai', new OpenAIProvider({ apiKeyName: 'OPENAI_API_KEY' }));
registerProvider('gemini', new GeminiProvider());
registerProvider('fal', new FalProvider());
registerProvider('meshy', new MeshyProvider());
registerProvider('rodin', new MeshyProvider()); // Alias for Phase 7
registerProvider('internal', new InternalProvider());

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

