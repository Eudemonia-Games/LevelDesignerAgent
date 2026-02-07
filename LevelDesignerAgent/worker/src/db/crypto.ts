
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO_AES_256_GCM = 'AES-256-GCM';

export interface EncryptedSecret {
    algo: string;
    ciphertext_base64: string;
    nonce_base64: string;
    tag_base64: string; // Authentication tag for GCM
}

/**
 * Parses and validates the SECRETS_MASTER_KEY from env.
 * Complies with "Fail closed" rule.
 */
export function parseMasterKey(): Buffer {
    const rawKey = process.env.SECRETS_MASTER_KEY;
    if (!rawKey) {
        throw new Error("Missing SECRETS_MASTER_KEY env var");
    }

    let keyBuffer: Buffer;
    try {
        keyBuffer = Buffer.from(rawKey, 'base64');
    } catch (e) {
        throw new Error("Invalid SECRETS_MASTER_KEY (not base64)");
    }

    if (keyBuffer.length !== 32) {
        throw new Error(`Invalid SECRETS_MASTER_KEY length: got ${keyBuffer.length} bytes, expected 32`);
    }

    return keyBuffer;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 */
export function encryptSecret(plaintext: string): EncryptedSecret {
    const key = parseMasterKey();
    const nonce = randomBytes(12); // GCM standard nonce length

    const cipher = createCipheriv('aes-256-gcm', key, nonce);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return {
        algo: ALGO_AES_256_GCM,
        ciphertext_base64: encrypted,
        nonce_base64: nonce.toString('base64'),
        tag_base64: authTag.toString('base64')
    };
}

/**
 * Decrypts a secret record.
 */
export function decryptSecret(record: { ciphertext_base64: string, nonce_base64: string, tag_base64: string }): string {
    const key = parseMasterKey();

    const nonce = Buffer.from(record.nonce_base64, 'base64');
    const ciphertext = Buffer.from(record.ciphertext_base64, 'base64');
    const tag = Buffer.from(record.tag_base64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);

    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
}
