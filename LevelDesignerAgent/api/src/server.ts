import Fastify from 'fastify';
import { APP_VERSION } from '@lda/shared';

export const buildServer = () => {
    const server = Fastify();

    server.get('/health', async () => {
        return {
            status: "ok",
            service: "api",
            version: APP_VERSION
        };
    });

    return server;
};
