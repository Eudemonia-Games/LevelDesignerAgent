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
    const asset_key_hash = crypto.createHash('sha256').update(`${kind}:${slug}:${Date.now()}`).digest('hex'); // Unique per upload for now

    const res = await getPool().query(`
        INSERT INTO assets (asset_key_hash, kind, slug, provider, model_id, prompt_text, prompt_hash, metadata_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    `, [asset_key_hash, kind, slug, provider, model_id, prompt_text, prompt_hash, metadata_json]);

    return res.rows[0].id;
}

export async function createAssetFile(
    assetId: string,
    fileData: Buffer | string,
    fileKind: string,
    options?: { mimeType?: string, fileExt?: string }
): Promise<string> {
    const buffer = typeof fileData === 'string' ? Buffer.from(fileData) : fileData;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const size = buffer.length;

    // Determine extension and mime
    let mimeType = options?.mimeType || mime.lookup(fileKind) || 'application/octet-stream';
    let ext = options?.fileExt || mime.extension(mimeType) || 'bin';

    // Special case for 'model/gltf-binary' -> .glb
    if (mimeType === 'model/gltf-binary' && !options?.fileExt) {
        ext = 'glb';
    }

    const r2Key = `assets/${assetId}/${fileKind}.${ext}`;

    await uploadAsset(r2Key, buffer, mimeType);

    await getPool().query(`
        INSERT INTO asset_files (asset_id, file_kind, r2_key, mime_type, bytes_size, sha256)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [assetId, fileKind, r2Key, mimeType, size, sha256]);

    return r2Key;
}

export async function getAssetFileR2Key(assetId: string): Promise<string | null> {
    const res = await getPool().query(`
        SELECT r2_key FROM asset_files WHERE asset_id = $1 LIMIT 1
    `, [assetId]);
    return res.rows[0]?.r2_key || null;
}
