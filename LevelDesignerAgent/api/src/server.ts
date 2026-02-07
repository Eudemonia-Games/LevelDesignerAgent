import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { APP_VERSION } from '@lda/shared';
import { authRoutes, AuthService } from './auth';
import { secretsRoutes } from './routes/secrets';


// ... (rest of file)

export const buildServer = async () => {
    const server = Fastify();

    await server.register(cors, {
        credentials: true,
        origin: (origin, cb) => {
            const allowedOrigin = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS;

            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return cb(null, true);

            // In dev (no env var) or if explicitly set to *, allow all
            // CAUTION: with credentials: true, wildcard * is NOT allowed by browsers.
            // We should enforce explicit origins.
            if (!allowedOrigin || allowedOrigin === '*') {
                return cb(null, true);
            }

            const allowedOrigins = allowedOrigin.split(',').map(o => o.trim().replace(/\/$/, ""));
            const cleanOrigin = origin.replace(/\/$/, "");

            if (allowedOrigins.includes(cleanOrigin)) {
                return cb(null, true);
            }

            console.warn(`⚠️ [CORS] Blocked request from origin: '${origin}' (clean: '${cleanOrigin}'). Allowed: ${JSON.stringify(allowedOrigins)}`);
            cb(new Error("Not allowed by CORS"), false);
        }
    });

    server.register(cookie, {
        secret: process.env.SESSION_COOKIE_SECRET || "fallback-secret-unsafe",
        parseOptions: {}
    });



    server.addHook('onRequest', async (req, reply) => {
        // Public Routes & Preflight
        if (req.method === 'OPTIONS') return;
        if (req.url.startsWith('/health')) return;
        if (req.url === '/auth/login') return;

        // Check Auth
        const isAuthenticated = await AuthService.verifySession(req);
        if (!isAuthenticated) {
            return reply.code(401).send({ ok: false, error: "unauthorized" });
        }
    });



    server.register(authRoutes);
    server.register(secretsRoutes);

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
