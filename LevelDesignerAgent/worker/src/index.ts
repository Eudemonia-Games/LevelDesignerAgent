import { APP_VERSION } from '@lda/shared';

console.log(`[Worker] Starting up... Version: ${APP_VERSION}`);

setInterval(() => {
    console.log('[Worker] Heartbeat...');
}, 30000);
