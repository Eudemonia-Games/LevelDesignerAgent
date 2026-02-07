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

export async function createAssetFile(assetId: string, fileData: Buffer | string, fileKind: string): Promise<string> {
    const buffer = typeof fileData === 'string' ? Buffer.from(fileData) : fileData;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const size = buffer.length;

    // Upload to R2
    // Key format: assets/<asset_id>/<file_kind>.<ext>
    // We guess extension from mime type or default
    // Wait, let's keep it simple: assets/<sha256>
    // Deduplication at storage level? Or logical level?
    // Design doc says: "asset_files (r2_key unique)"
    // Let's use `assets/{assetId}/{fileKind}` for now to be distinct.

    const ext = mime.extension(mime.lookup(fileKind) || 'application/octet-stream') || 'bin';
    const r2Key = `assets/${assetId}/${fileKind}.${ext}`; // e.g. assets/UUID/grid_image.png

    await uploadAsset(r2Key, buffer, mime.lookup(fileKind) || 'application/octet-stream');

    await getPool().query(`
        INSERT INTO asset_files (asset_id, file_kind, r2_key, mime_type, bytes_size, sha256)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [assetId, fileKind, r2Key, mime.lookup(fileKind) || 'application/octet-stream', size, sha256]);

    return r2Key;
}
