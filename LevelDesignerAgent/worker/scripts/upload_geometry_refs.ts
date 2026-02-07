import fs from 'fs';
import path from 'path';

// Robust Env Loading FIRST
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
        }
    });
}

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
}
if (!process.env.SECRETS_MASTER_KEY) {
    console.error("SECRETS_MASTER_KEY not set");
    process.exit(1);
}

// Now dynamic import
async function uploadRefs() {
    console.log("Modules loading...");
    const { uploadAsset } = await import('../src/storage/r2');

    console.log("Uploading Geometry Refs...");

    // Create dummy ref images if they don't exist
    const refsDir = path.resolve(__dirname, '../static/geometry_refs');
    if (!fs.existsSync(refsDir)) {
        fs.mkdirSync(refsDir, { recursive: true });

        // Create dummy PNG content (1x1 pixel)
        // Base64 for 1x1 red pixel
        const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

        fs.writeFileSync(path.join(refsDir, 'ref_cube.png'), pixel);
        fs.writeFileSync(path.join(refsDir, 'ref_sphere.png'), pixel);
        console.log("Created dummy ref images.");
    }

    const files = fs.readdirSync(refsDir);

    for (const file of files) {
        if (!file.endsWith('.png')) continue;

        const filePath = path.join(refsDir, file);
        const fileContent = fs.readFileSync(filePath);
        const key = `assets/refs/${file}`;

        console.log(`Uploading ${file} to ${key}...`);

        try {
            await uploadAsset(key, fileContent, 'image/png');
            console.log(`✅ Uploaded ${key}`);
        } catch (e: any) {
            console.error(`❌ Failed to upload ${file}:`, e.message);
        }
    }

    process.exit(0);
}

uploadRefs().catch(err => {
    console.error(err);
    process.exit(1);
});
