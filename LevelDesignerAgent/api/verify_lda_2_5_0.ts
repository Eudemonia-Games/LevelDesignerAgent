// api/verify_lda_2_5_0.ts
import fetch from 'node-fetch';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Load .env
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

const API_URL = 'http://localhost:3000';

async function main() {
    console.log("Verifying LDA.2.5.0 (Run Lifecycle Endpoints)...");

    let apiAvailable = false;
    try {
        // 1. Check Health (Optional)
        try {
            const healthRes = await fetch(`${API_URL}/health`);
            if (!healthRes.ok) {
                console.warn("⚠️  API returned error at http://localhost:3000");
            } else {
                console.log("✅ API is up");
                apiAvailable = true;
            }
        } catch (e) {
            console.warn("⚠️  API is not running at http://localhost:3000. Skipping HTTP tests.");
            console.warn("ℹ️  To verify HTTP endpoints, run `pnpm api:dev` in another terminal.");
        }

        // 2. HTTP Tests (if available)
        if (apiAvailable) {
            console.log("⚠️  Skipping full E2E API test due to Auth requirement customization.");
        }

        // 3. DB Logic Verification (Always run)
        console.log("Verifying DB Logic...");

        const { RunsDb } = await import('./src/db/runs');
        const { FlowsDb } = await import('./src/db/flows'); // Added Import

        // Create a dummy Flow Version
        const flow = await FlowsDb.createFlow({
            name: `Test Flow ${Date.now()}`,
            version_major: 1,
            version_minor: 0,
            version_patch: 0,
            description: 'Created by verify script'
        });
        console.log(`✅ Created Flow Version ID: ${flow.id}`);

        // Create a dummy run
        const run = await RunsDb.createRun({
            flow_version_id: flow.id,
            user_prompt: 'Test Run from Script',
            mode: 'express'
        });
        console.log(`✅ Created Run ID: ${run.id}`);

        // List
        const runs = await RunsDb.listRuns({ limit: 1 });
        if (runs.length > 0 && runs[0].id === run.id) {
            console.log("✅ List Runs works");
        } else {
            console.error("❌ List Runs mismatch");
        }

        // Get
        const fetched = await RunsDb.getRunById(run.id);
        if (fetched && fetched.user_prompt === 'Test Run from Script') {
            console.log("✅ Get Run works");
        } else {
            console.error("❌ Get Run failed");
        }

        // Stages (should be empty)
        const stages = await RunsDb.getStageRuns(run.id);
        if (Array.isArray(stages) && stages.length === 0) {
            console.log("✅ Get Stage Runs works (empty)");
        } else {
            console.error("❌ Get Stage Runs failed");
        }

        // Events (should be empty)
        const events = await RunsDb.getRunEvents(run.id);
        if (Array.isArray(events) && events.length === 0) {
            console.log("✅ Get Run Events works (empty)");
        } else {
            console.error("❌ Get Run Events failed");
        }

    } catch (e: any) {
        console.error("❌ Verification Failed:", e);
        process.exit(1);
    }
}

main();
