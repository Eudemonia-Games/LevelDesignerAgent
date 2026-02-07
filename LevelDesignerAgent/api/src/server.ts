import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { APP_VERSION } from '@lda/shared';
import { authRoutes, AuthService } from './auth';
import { assetsRoutes } from './routes/assets';
import { runsRoutes } from './routes/runs';
import { exportRoutes } from './routes/export';
import { seedDefaults } from './db/seed';
import { getDbConfig } from './db/utils';

export const buildServer = async () => {
    const server = Fastify();

    await server.register(cors, {
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

        // Public Library Access
        if (req.method === 'GET' && req.url.startsWith('/api/v1/assets')) return;

        // Check Auth
        const isAuthenticated = await AuthService.verifySession(req);
        if (!isAuthenticated) {
            return reply.code(401).send({ ok: false, error: "unauthorized" });
        }
    });

    server.register(authRoutes);
    server.register(assetsRoutes);
    server.register(runsRoutes);
    server.register(exportRoutes);

    // Admin / Test Routes
    const { adminRoutes } = await import('./routes/admin');
    server.register(adminRoutes);

    server.addHook('onReady', async () => {
        if (process.env.DATABASE_URL) {
            await seedDefaults().catch(err => console.error("Seed failed:", err));
        }
    });

    server.get('/health', async () => {
        let dbStatus = "unknown";
        let dbError: string | undefined;

        if (process.env.DATABASE_URL) {
            try {
                // Quick connectivity check
                const { Client } = await import("pg");
                const client = new Client(getDbConfig(process.env.DATABASE_URL));
                await client.connect();

                // Verify critical tables exist
                const res = await client.query(`
                    SELECT 
                        to_regclass('auth_sessions') as auth,
                        to_regclass('secrets') as secrets,
                        to_regclass('flow_versions') as flows
                `);
                await client.end();

                if (res.rows[0].auth && res.rows[0].secrets && res.rows[0].flows) {
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
