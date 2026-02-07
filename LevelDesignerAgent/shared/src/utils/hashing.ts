import { createHash } from 'crypto';

export function computeAssetKeyHash(
    kind: string,
    modelId: string,
    prompt: string,
    metadata: Record<string, any> = {}
): string {
    // Canonicalize metadata by sorting keys
    const canonicalMetadata = Object.keys(metadata).sort().reduce((obj: any, key) => {
        obj[key] = metadata[key];
        return obj;
    }, {});

    const payload = JSON.stringify({
        kind,
        modelId,
        prompt: prompt.trim(),
        metadata: canonicalMetadata
    });

    return createHash('sha256').update(payload).digest('hex');
}
