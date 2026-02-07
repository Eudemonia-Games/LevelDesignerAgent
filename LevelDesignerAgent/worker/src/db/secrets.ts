import { Client } from 'pg';
import { decryptSecret } from './crypto';
import { getDbConfig } from './utils'; // Assuming utils exists in worker/src/db/utils or similar

// --- Known Secrets Whitelist ---
export const KNOWN_SECRETS = [
    // AI Providers
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "FAL_API_KEY",
    "MESHY_API_KEY",
    "RODIN_API_KEY",

    // Cloudflare R2
    "CF_R2_ACCOUNT_ID",
    "CF_R2_ACCESS_KEY_ID",
    "CF_R2_SECRET_ACCESS_KEY",
    "CF_R2_BUCKET_NAME",
    "CF_R2_ENDPOINT",
    "CF_R2_PUBLIC_BASE_URL",

    // Rendering / Hosting
    "RENDER_DEPLOY_HOOK_URL",
    "RENDER_API_KEY"
];

export const SecretsService = {

    async getClient(): Promise<Client> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");
        // Reuse existing connection logic if possible, but creating new client is safe for occasional secret fetch
        const client = new Client(getDbConfig(dbUrl));
        await client.connect();
        return client;
    },

    /**
     * Gets a decrypted secret value by key.
     * Internal use only - never expose this directly via API.
     */
    async getDecryptedSecret(key: string): Promise<string | undefined> {
        const client = await this.getClient();

        try {
            const res = await client.query(`
                SELECT key, algo, ciphertext_base64, nonce_base64, tag_base64 
                FROM secrets 
                WHERE key = $1
            `, [key]);

            if (res.rows.length === 0) return undefined;

            return decryptSecret(res.rows[0]);
        } catch (e) {
            console.error(`Failed to get/decrypt secret ${key}:`, e);
            return undefined;
        } finally {
            await client.end();
        }
    }
};
