import { Client } from 'pg';
import { encryptSecret, decryptSecret } from './crypto';
import { getDbConfig } from '../db/utils';

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

export interface SecretItem {
    key: string;
    isSet: boolean;
    masked: string | null;
    updatedAt: string | null;
}

export const SecretsService = {
    /**
     * Lists all known secrets with their status and masked value.
     */
    async getAllSecrets(): Promise<SecretItem[]> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");



        // ...

        const client = new Client(getDbConfig(dbUrl));

        try {
            await client.connect();
            const res = await client.query(`
                SELECT key, algo, ciphertext_base64, nonce_base64, tag_base64, updated_at
                FROM secrets
            `);

            const rowsMap = new Map<string, any>();
            res.rows.forEach(row => rowsMap.set(row.key, row));

            return KNOWN_SECRETS.map(key => {
                const row = rowsMap.get(key);
                if (!row) {
                    return { key, isSet: false, masked: null, updatedAt: null };
                }

                try {
                    const plaintext = decryptSecret(row);
                    return {
                        key,
                        isSet: true,
                        masked: maskSecret(plaintext),
                        updatedAt: row.updated_at
                    };
                } catch (e) {
                    console.error(`Failed to decrypt secret ${key}:`, e);
                    return { key, isSet: true, masked: "ERROR_DECRYPT", updatedAt: row.updated_at };
                }
            });

        } finally {
            await client.end();
        }
    },

    /**
     * Sets (encrypts and upserts) a secret.
     */
    async setSecret(key: string, value: string): Promise<SecretItem> {
        if (!KNOWN_SECRETS.includes(key)) {
            throw new Error(`Unknown secret key: ${key}`);
        }

        const trimmedValue = value.trim();
        if (!trimmedValue) {
            throw new Error("Value cannot be empty");
        }

        const encrypted = encryptSecret(trimmedValue);

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");

        const client = new Client(getDbConfig(dbUrl));

        try {
            await client.connect();
            const res = await client.query(`
                INSERT INTO secrets (key, algo, ciphertext_base64, nonce_base64, tag_base64, updated_at)
                VALUES ($1, $2, $3, $4, $5, now())
                ON CONFLICT (key) DO UPDATE SET
                    algo=EXCLUDED.algo,
                    ciphertext_base64=EXCLUDED.ciphertext_base64,
                    nonce_base64=EXCLUDED.nonce_base64,
                    tag_base64=EXCLUDED.tag_base64,
                    updated_at=now()
                RETURNING updated_at
            `, [key, encrypted.algo, encrypted.ciphertext_base64, encrypted.nonce_base64, encrypted.tag_base64]);

            return {
                key,
                isSet: true,
                masked: maskSecret(trimmedValue),
                updatedAt: res.rows[0].updated_at
            };
        } finally {
            await client.end();
        }
    }
};

function maskSecret(value: string): string {
    if (value.length <= 8) return "********";
    return value.slice(0, 4) + "••••" + value.slice(-4);
}
