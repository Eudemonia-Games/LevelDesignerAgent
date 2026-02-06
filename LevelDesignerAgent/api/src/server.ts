import Fastify from 'fastify';
import cors from '@fastify/cors';
import { APP_VERSION } from '@lda/shared';

export const buildServer = async () => {
    const server = Fastify();

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
        let dbStatus = "unknown";
        let dbError: string | undefined;

        if (process.env.DATABASE_URL) {
            try {
                // Quick connectivity check
                const { Client } = await import("pg");
                const client = new Client({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
                });
                await client.connect();

                // Verify critical tables exist
                const res = await client.query(`
                    SELECT 
                        to_regclass('auth_sessions') as auth,
                        to_regclass('secrets') as secrets
                `);
                await client.end();

                if (res.rows[0].auth && res.rows[0].secrets) {
                    dbStatus = "ok";
                } else {
                    dbStatus = "missing_tables";
                }
            } catch (err: any) {
                dbStatus = "error";
                dbError = err.message;
            }
        } else {
            dbStatus = "not_configured";
        }

        return {
            status: "ok",
            service: "api",
            version: APP_VERSION,
            db: {
                status: dbStatus,
                error: dbError
            }
        };
    });

    return server;
};
