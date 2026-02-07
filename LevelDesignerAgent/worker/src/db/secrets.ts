import { getPool } from './jobs';
import { decryptSecret } from './crypto';

export async function getSecret(key: string): Promise<string | null> {
    const res = await getPool().query(`
        SELECT key, algo, ciphertext_base64, nonce_base64, tag_base64 
        FROM secrets 
        WHERE key = $1
    `, [key]);

    if (res.rows.length === 0) return null;

    try {
        return decryptSecret(res.rows[0]);
    } catch (e) {
        console.error(`Failed to decrypt secret ${key}:`, e);
        return null; // Treat as missing if corrupted/undecryptable
    }
}
