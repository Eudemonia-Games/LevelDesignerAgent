import Fastify from 'fastify';
import cors from '@fastify/cors';
import { APP_VERSION } from '@lda/shared';

export const buildServer = async () => {
    const server = Fastify();

    try {
        console.log('DEBUG: APP_VERSION =', APP_VERSION);
        console.log('DEBUG: @lda/shared path =', require.resolve('@lda/shared'));
    } catch (e) {
        console.log('DEBUG: Error resolving path', e);
    }

    await server.register(cors, {
        origin: (origin, cb) => {
            const allowedOrigin = process.env.CORS_ORIGIN;
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return cb(null, true);

            // In dev (no env var) or if explicitly set to *, allow all
            if (!allowedOrigin || allowedOrigin === '*') {
                return cb(null, true);
            }

            const allowedOrigins = allowedOrigin.split(',').map(o => o.trim());
            if (allowedOrigins.includes(origin)) {
                return cb(null, true);
            }

            cb(new Error("Not allowed by CORS"), false);
        }
    });

    server.get('/health', async () => {
        return {
            status: "ok",
            service: "api",
            version: APP_VERSION
        };
    });

    return server;
};
