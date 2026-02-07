import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { APP_VERSION } from '@lda/shared';
import { authRoutes, AuthService } from './auth';
import { assetsRoutes } from './routes/assets';
import { runsRoutes } from './routes/runs';
import { exportRoutes } from './routes/export';
// import { seedDefaults } from './db/seed';
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

        // Public Library Access (Assets & Runs)
        if (req.method === 'GET' && req.url.startsWith('/api/v1/assets')) return;
        if (req.method === 'GET' && req.url.startsWith('/api/v1/runs')) return;

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

    const { designRoutes } = await import('./routes/design');
    server.register(designRoutes);

    const { secretsRoutes } = await import('./routes/secrets');
    server.register(secretsRoutes);

    // Debug: Log 404s to see what's missing
    server.setNotFoundHandler((req, reply) => {
        req.log.warn({ method: req.method, url: req.url }, 'Route not found');
        reply.code(404).send({ ok: false, error: 'not_found', url: req.url });
    });

    // server.addHook('onReady', async () => {
    //    if (process.env.DATABASE_URL) {
    //        await seedDefaults().catch(err => console.error("Seed failed:", err));
    //    }
    // });

    server.get('/health', async () => {
        let dbStatus = "unknown";
        let dbError: string | undefined;

        if (process.env.DATABASE_URL) {
            try {
                // Quick connectivity check with strict timeout
                const dbCheck = async () => {
                    const { Client } = await import("pg");
                    const client = new Client({
                        ...getDbConfig(process.env.DATABASE_URL!),
                        connectionTimeoutMillis: 3000 // 3s connect timeout
                    });
                    await client.connect();
                    // Just check one table or simple query
                    await client.query('SELECT 1');
                    await client.end();
                    return "ok";
                };

                // Race against a 4s timeout prevents hanging requests
                dbStatus = await Promise.race([
                    dbCheck(),
                    new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 4000))
                ]);

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

    server.get('/', async () => {
        return { service: "api", status: "ok", version: APP_VERSION };
    });

    return server;
};
