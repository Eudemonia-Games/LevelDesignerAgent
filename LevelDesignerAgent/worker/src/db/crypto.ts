import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// const IV_LENGTH = 16;
// const TAG_LENGTH = 16;
const MASTER_KEY_B64 = process.env.SECRETS_MASTER_KEY;

if (!MASTER_KEY_B64) {
    // In dev/test, might not be set. But for worker to decrypt, it must be set.
    // We throw error only when trying to decrypt if key is missing.
}

export function decryptSecret(row: { key: string, algo: string, ciphertext_base64: string, nonce_base64: string, tag_base64: string }): string {
    if (!MASTER_KEY_B64) {
        throw new Error("SECRETS_MASTER_KEY not set in env");
    }

    if (row.algo !== 'AES-256-GCM') {
        throw new Error(`Unsupported algorithm: ${row.algo}`);
    }

    const masterKey = Buffer.from(MASTER_KEY_B64, 'base64');
    if (masterKey.length !== 32) {
        throw new Error("SECRETS_MASTER_KEY must be 32 bytes (base64 encoded)");
    }

    const iv = Buffer.from(row.nonce_base64, 'base64');
    const tag = Buffer.from(row.tag_base64, 'base64');
    const encryptedText = Buffer.from(row.ciphertext_base64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
}
