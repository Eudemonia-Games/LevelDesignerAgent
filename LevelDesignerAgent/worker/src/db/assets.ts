import { getPool } from './jobs';
import { uploadAsset } from '../storage/r2';
import * as crypto from 'crypto';
import * as mime from 'mime-types';

export interface AssetMetadata {
    kind: string;
    slug: string;
    provider?: string;
    model_id?: string;
    prompt_text?: string;
    metadata_json?: any;
}

export async function createAsset(metadata: AssetMetadata): Promise<string> {
    const { kind, slug, provider = 'internal', model_id = '', prompt_text = '', metadata_json = {} } = metadata;
    const prompt_hash = crypto.createHash('sha256').update(prompt_text).digest('hex');
    const asset_key_hash = crypto.createHash('sha256').update(`${kind}:${slug}:${Date.now()}`).digest('hex');

    const res = await getPool().query(`
        INSERT INTO assets (asset_key_hash, kind, slug, provider, model_id, prompt_text, prompt_hash, metadata_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    `, [asset_key_hash, kind, slug, provider, model_id, prompt_text, prompt_hash, metadata_json]);

    return res.rows[0].id;
}

export type CreateAssetFileOpts = {
    mimeType?: string;
    fileExt?: string; // without dot
};

/**
 * Uploads an asset file to R2 and inserts an asset_files row.
 *
 * fileKind: logical kind used for asset_files.file_kind + r2 key naming (e.g. 'png', 'glb', 'source')
 * opts.mimeType + opts.fileExt override guessing (recommended for correctness)
 */
export async function createAssetFile(
    assetId: string,
    fileData: Buffer | string,
    fileKind: string,
    opts: CreateAssetFileOpts = {}
): Promise<string> {
    const buffer = typeof fileData === 'string' ? Buffer.from(fileData) : fileData;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const size = buffer.length;

    const guessedMime = (opts.mimeType || (mime.lookup(opts.fileExt || fileKind) as string) || (mime.lookup(fileKind) as string) || 'application/octet-stream');
    const ext = (opts.fileExt || (mime.extension(guessedMime) as string) || 'bin').replace(/^\./, '');

    const r2Key = `assets/${assetId}/${fileKind}.${ext}`;

    await uploadAsset(r2Key, buffer, guessedMime);

    await getPool().query(`
        INSERT INTO asset_files (asset_id, file_kind, r2_key, mime_type, bytes_size, sha256)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [assetId, fileKind, r2Key, guessedMime, size, sha256]);

    return r2Key;
}

export async function getAssetFileR2Key(assetId: string): Promise<string | null> {
    const res = await getPool().query(`
        SELECT r2_key FROM asset_files WHERE asset_id = $1 LIMIT 1
    `, [assetId]);
    return res.rows[0]?.r2_key || null;
}
