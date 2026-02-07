// api/verify_lda_4_4_0.ts
import fs from 'fs';
import path from 'path';

// 1. ROBUST ENV LOADING
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function verifyCollisionStrategy() {
    console.log("Verifying LDA.4.4.0 (Collision Strategy)...");

    const { AssetsDb } = await import('./src/db/assets');

    // 1. Create a dummy asset
    const asset = await AssetsDb.createAsset(
        'prop_model_source', // Valid enum from schemaSql
        'internal',
        'test-collision-model',
        'checking collision metadata',
        { original: true },
        'collision-test-asset'
    );
    console.log(`Created asset: ${asset.id}`);

    // 2. Update collision metadata
    const collisionMeta = {
        collision: {
            type: 'box',
            size: [2, 4, 2]
        }
    };

    console.log("Updating metadata...", collisionMeta);
    await AssetsDb.updateAssetMetadata(asset.id, collisionMeta);

    // 3. Verify
    const updated = await AssetsDb.getAsset(asset.id);
    console.log("Fetched updated asset metadata:", JSON.stringify(updated?.metadata_json, null, 2));

    if (updated?.metadata_json?.collision?.type === 'box' &&
        updated?.metadata_json?.original === true) {
        console.log("✅ Verification PASSED: Metadata merged successfully.");
    } else {
        console.error("❌ Verification FAILED: Metadata mismatch.");
        process.exit(1);
    }
}

verifyCollisionStrategy().catch(e => {
    console.error("❌ Test Failed:", e);
    process.exit(1);
});
