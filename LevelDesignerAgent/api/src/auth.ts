
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { getDbConfig } from './db/utils';

// --- Constants ---
const SESSION_COOKIE_NAME = 'lda_session';

// Helper to get config
const getConfig = () => {
    const secret = process.env.SESSION_COOKIE_SECRET;
    const ttl = parseInt(process.env.SESSION_TTL_HOURS || '168', 10);
    if (!secret) {
        console.error("❌ [Auth] SESSION_COOKIE_SECRET is not set! Auth will fail.");
    }
    return { secret, ttl };
};

// --- Types ---
interface LoginBody {
    username: string;
    password: string;
}

declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            username: string;
            isAdmin: true;
        };
    }
}

// --- Service ---
export const AuthService = {
    async verifySession(req: FastifyRequest): Promise<boolean> {
        const rawToken = req.cookies[SESSION_COOKIE_NAME];
        if (!rawToken) {
            return false;
        }

        const unsignResult = req.unsignCookie(rawToken);
        if (!unsignResult.valid || !unsignResult.value) {
            return false;
        }

        const token = unsignResult.value;
        const tokenHash = createHash('sha256').update(token).digest('hex');

        // Check DB
        // NOTE: We create a new client here for simplicity, or we could use a pool if available globally.
        // For this implementation, we'll assume a new client per check is acceptable for low traffic,
        // or effectively we should attach a pool to Fastify.
        // To avoid connection overhead on every request, a Pool is strictly better.
        // BUT, given the scope, let's try to reuse the DATABASE_URL.

        // TODO: Refactor server to have a global DB pool. For now, creating a client.
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) return false;



        // ...

        const client = new Client(getDbConfig(dbUrl));

        try {
            await client.connect();

            const res = await client.query(`
                SELECT id, expires_at, last_seen_at 
                FROM auth_sessions 
                WHERE session_token_hash = $1 
                  AND revoked_at IS NULL 
                  AND expires_at > now()
            `, [tokenHash]);

            if (res.rows.length === 0) {
                return false;
            }

            const session = res.rows[0];

            // Throttle last_seen_at updates (every 60s)
            const lastSeen = new Date(session.last_seen_at).getTime();
            const now = Date.now();
            if (now - lastSeen > 60000) {
                // Fire and forget update
                await client.query('UPDATE auth_sessions SET last_seen_at = now() WHERE id = $1', [session.id])
                    .catch(e => console.error("Failed to update last_seen_at", e));
            }

            return true;
        } catch (err) {
            console.error("Auth session verify failed:", err);
            return false;
        } finally {
            await client.end();
        }
    },

    async createSession(res: FastifyReply): Promise<void> {
        const rawToken = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");

        let connectionString = dbUrl;
        if (dbUrl.includes("channel_binding")) {
            connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
        }

        const client = new Client({
            connectionString,
            ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false }
        });

        try {
            await client.connect();

            const { ttl } = getConfig();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + ttl);

            await client.query(`
                INSERT INTO auth_sessions (session_token_hash, expires_at)
                VALUES ($1, $2)
            `, [tokenHash, expiresAt]);

            // Set Cookie


            res.setCookie(SESSION_COOKIE_NAME, rawToken, {
                httpOnly: true,
                secure: true, // Must be true for sameSite: 'none'
                sameSite: 'none',
                path: '/',
                signed: true,
                expires: expiresAt
            });

        } finally {
            await client.end();
        }
    },

    async revokeSession(req: FastifyRequest, res: FastifyReply): Promise<void> {
        const rawToken = req.cookies[SESSION_COOKIE_NAME];

        // Always clear cookie
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

        if (!rawToken) return;

        const unsignResult = req.unsignCookie(rawToken);
        if (!unsignResult.valid || !unsignResult.value) return;

        const token = unsignResult.value;
        const tokenHash = createHash('sha256').update(token).digest('hex');

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) return;

        let connectionString = dbUrl;
        if (dbUrl.includes("channel_binding")) {
            connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
        }

        const client = new Client({
            connectionString,
            ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false }
        });

        try {
            await client.connect();
            await client.query(`
                UPDATE auth_sessions 
                SET revoked_at = now() 
                WHERE session_token_hash = $1
            `, [tokenHash]);
        } finally {
            await client.end();
        }
    }
};

// --- Routes ---
export async function authRoutes(server: FastifyInstance) {
    server.post<{ Body: LoginBody }>('/auth/login', async (req, reply) => {
        const { username, password } = req.body;

        const adminUser = process.env.ADMIN_USERNAME;
        const adminHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminUser || !adminHash || !process.env.SESSION_COOKIE_SECRET) {
            return reply.code(500).send({ ok: false, error: "auth_misconfigured" });
        }

        if (username !== adminUser) {
            return reply.code(401).send({ ok: false, error: "invalid_credentials" });
        }

        const match = await bcrypt.compare(password, adminHash);
        if (!match) {
            return reply.code(401).send({ ok: false, error: "invalid_credentials" });
        }

        try {
            await AuthService.createSession(reply);
            return { ok: true };
        } catch (err) {
            req.log.error(err);
            return reply.code(500).send({ ok: false, error: "internal_error" });
        }
    });

    server.post('/auth/logout', async (req, reply) => {
        await AuthService.revokeSession(req, reply);
        return { ok: true };
    });

    server.get('/auth/me', async (_req, _reply) => {
        // This endpoint relies on the global guard seeing the cookie, 
        // OR we specifically check it here if the guard allows pass-through.
        // Assuming global guard protects strict routes, but we might want /auth/me to return 200 {username} or 401.
        // If we put this BEHIND the guard, it will 401 automatically if not auth.
        // If we put it OUTSIDE, we check manually.

        // Current plan: Gate EVERYTHING except /health and /login.
        // So if this is hit, user IS authenticated.
        const adminUser = process.env.ADMIN_USERNAME || 'admin';
        return { ok: true, username: adminUser };
    });
}
