// api/verify_lda_4_1_0.ts
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

async function verifyAssetDedup() {
    console.log("Verifying LDA.4.1.0 (Asset Dedup)...");

    const { AssetsDb } = await import('./src/db/assets');

    const testData = {
        kind: 'prompt_text',
        provider: 'internal',
        modelId: 'test-model',
        prompt: 'This is a test prompt for deduplication',
        metadata: { version: 1, tag: 'test' }
    };

    console.log("Creating Asset A...");
    const assetA = await AssetsDb.createAsset(
        testData.kind,
        testData.provider,
        testData.modelId,
        testData.prompt,
        testData.metadata,
        'test-slug-a'
    );
    console.log(`Asset A ID: ${assetA.id}`);

    console.log("Creating Asset B (Identical content)...");
    const assetB = await AssetsDb.createAsset(
        testData.kind,
        testData.provider,
        testData.modelId,
        testData.prompt,
        testData.metadata,
        'test-slug-b' // Slug might differ, but hash should invoke reuse? 
        // Logic check: createAsset impl doesn't check slug in hash currently. 
        // Hash is based on content.
    );
    console.log(`Asset B ID: ${assetB.id}`);

    if (assetA.id === assetB.id) {
        console.log("✅ verification PASSED: Asset ID reused.");
    } else {
        console.error("❌ verification FAILED: Asset IDs differ.");
        process.exit(1);
    }
}

verifyAssetDedup().catch(e => {
    console.error("❌ Test Failed:", e);
    process.exit(1);
});
