import { claimRun, claimJob, updateJobResult, updateJobError } from '../db/jobs';
import { executeRun } from './executeRun';
import { processTestProviderJob } from '../jobs/testProvider';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000');
const STALE_THRESHOLD_MS = parseInt(process.env.WORKER_STALE_RUN_MS || '300000');

let isRunning = false;

export function startPoller() {
    console.log(`[Worker] Starting poll loop (Interval: ${POLL_INTERVAL_MS}ms, Stale: ${STALE_THRESHOLD_MS}ms)`);
    isRunning = true;
    poll();
}

export function stopPoller() {
    isRunning = false;
}

async function poll() {
    if (!isRunning) return;

    try {
        let workFound = false;

        // 1. Check for Generic Jobs (High Priority)
        const job = await claimJob(STALE_THRESHOLD_MS);
        if (job) {
            workFound = true;
            console.log(`[Worker] Claimed job ${job.id} (type: ${job.type})`);

            try {
                if (job.type === 'test_provider_call') {
                    const result = await processTestProviderJob(job);
                    if (result.success) {
                        await updateJobResult(job.id, result.data);
                    } else {
                        await updateJobError(job.id, result.error || 'Unknown error');
                    }
                } else {
                    console.warn(`[Worker] Unknown job type: ${job.type}`);
                    await updateJobError(job.id, `Unknown job type: ${job.type}`);
                }
            } catch (err: any) {
                console.error(`[Worker] Job processing failed:`, err);
                await updateJobError(job.id, err.message);
            }
        }

        // 2. Check for Runs (if no job found or maybe always check?)
        // Let's check runs only if we didn't find a job, or just check anyway?
        // To prevent starvation, let's allow one item per tick.
        if (!workFound) {
            const run = await claimRun(STALE_THRESHOLD_MS);
            if (run) {
                workFound = true;
                console.log(`[Worker] Claimed run ${run.id} (status: ${run.status})`);
                await executeRun(run);
            }
        }

        if (workFound) {
            // Poll again immediately
            setImmediate(poll);
        } else {
            // Idle, wait
            setTimeout(poll, POLL_INTERVAL_MS);
        }

    } catch (e) {
        console.error("[Worker] Poll error:", e);
        setTimeout(poll, POLL_INTERVAL_MS);
    }
}
