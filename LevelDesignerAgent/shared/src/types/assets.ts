export type CollisionType = 'mesh' | 'box' | 'sphere' | 'capsule' | 'none';

export interface CollisionMetadata {
    type: CollisionType;
    size?: [number, number, number]; // For box
    radius?: number; // For sphere/capsule
    height?: number; // For capsule
    mess_source?: string; // If 'mesh', which file? defaults to self
}

export type AssetKind =
    | 'prompt_text' | 'spec_json' | 'grid_image'
    | 'anchor_exterior_image' | 'anchor_interior_image'
    | 'tile_image' | 'prop_image' | 'boss_image'
    | 'exterior_model_source' | 'exterior_model_runtime'
    | 'tile_model_source' | 'tile_model_runtime'
    | 'prop_model_source' | 'prop_model_runtime'
    | 'boss_model_source' | 'boss_model_runtime'
    | 'collision_mesh' | 'manifest_json' | 'debug_log';

export interface Asset {
    id: string;
    asset_key_hash: string;
    kind: AssetKind;
    slug: string;
    provider: string;
    model_id: string;
    prompt_text: string;
    metadata_json: Record<string, any>;
    created_at: string;
    // Optional joined fields
    files?: AssetFile[];
}

export interface AssetFile {
    id: string;
    asset_id: string;
    file_kind: AssetKind;
    r2_key: string;
    mime_type: string;
    bytes_size: number; // changed from bigint to number for JSON (or string if too large, but usually fine for assets < 9PB)
    width_px?: number;
    height_px?: number;
    tri_count?: number;
    created_at: string;
}
