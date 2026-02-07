import { Pool } from 'pg';
import { getDbConfig } from './utils';
import { Run, FlowStageTemplate, StageRun } from './types';

let pool: Pool | null = null;

export const getPool = (): Pool => {
    if (!pool) {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL not set");
        pool = new Pool(getDbConfig(dbUrl));
    }
    return pool;
};

// --- API ---

export interface Job {
    id: string;
    type: string;
    status: string;
    payload: any;
}

export async function claimJob(staleThresholdMs: number = 300000): Promise<Job | null> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');

        const staleDate = new Date(Date.now() - staleThresholdMs);

        const res = await client.query(`
            SELECT * FROM jobs 
            WHERE status = 'pending' 
               OR (status = 'processing' AND updated_at < $1)
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `, [staleDate]);

        const job = res.rows[0];

        if (job) {
            const updateRes = await client.query(`
                UPDATE jobs 
                SET status = 'processing', updated_at = now() 
                WHERE id = $1 
                RETURNING *
            `, [job.id]);

            await client.query('COMMIT');
            return updateRes.rows[0];
        } else {
            await client.query('COMMIT');
            return null;
        }

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error claiming job:", e);
        return null;
    } finally {
        client.release();
    }
}

export async function updateJobResult(id: string, result: any): Promise<void> {
    // Ensure result is a valid JSON value. 
    // If it's a string that isn't already JSON, we should probably wrap it or JSON.stringify it so it becomes a JSON string.
    // However, safest is to assume 'result' col stores an object or we let node-pg handle object->json.
    // If 'result' is a primitive string "foo", node-pg sends "foo". PG 'jsonb' expects '"foo"'.
    // If we rely on node-pg, we should pass non-objects as is? No.
    // Let's just wrap it in an object if it's not one, or rely on the caller to pass objects.
    // But since 'data' can be anything, let's just JSON.stringify it if it is not an object, 
    // OR just use a wrapper object in the DB logic? 
    // Actually, simply doing `JSON.stringify(result)` if it's not an object might be best, 
    // but checks are annoying.
    // Let's assume result should be an object.
    // If it is a string, wrap it: { value: result } ? No that changes schema.
    // Let's strict cast:
    const jsonVal = (typeof result === 'object' && result !== null) ? result : JSON.stringify(result);

    await getPool().query(`
        UPDATE jobs 
        SET status = 'completed', result = $2, updated_at = now()
        WHERE id = $1
    `, [id, jsonVal]);
}

export async function updateJobError(id: string, error: string): Promise<void> {
    await getPool().query(`
        UPDATE jobs 
        SET status = 'failed', error = $2, updated_at = now()
        WHERE id = $1
    `, [id, error]);
}

export async function claimRun(staleThresholdMs: number = 300000): Promise<Run | null> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');

        // 1. Recover stale runs (optional, simple heuristic)
        // We do this in a separate transaction or just rely on the main query if simple.
        // For simplicity, we can just include 'running' && old updated_at in the claim query.

        const staleDate = new Date(Date.now() - staleThresholdMs);

        // SELECT FOR UPDATE SKIP LOCKED
        // Priority: Created At ASC
        const res = await client.query(`
            SELECT * FROM runs 
            WHERE status = 'queued' 
               OR (status = 'running' AND updated_at < $1)
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `, [staleDate]);

        const run = res.rows[0];

        if (run) {
            // Claim it
            const updateRes = await client.query(`
                UPDATE runs 
                SET status = 'running', updated_at = now() 
                WHERE id = $1 
                RETURNING *
            `, [run.id]);

            const claimedRun = updateRes.rows[0];

            // Emit event
            await emitRunEventTx(client, claimedRun.id, 'info', 'Worker claimed run', { worker_id: process.env.HOSTNAME || 'unknown' });

            await client.query('COMMIT');
            return claimedRun;
        } else {
            await client.query('COMMIT');
            return null;
        }

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error claiming run:", e);
        return null;
    } finally {
        client.release();
    }
}

export async function getRunStages(flowVersionId: string): Promise<FlowStageTemplate[]> {
    const res = await getPool().query(`
        SELECT * FROM flow_stage_templates 
        WHERE flow_version_id = $1 
        ORDER BY order_index ASC
    `, [flowVersionId]);
    return res.rows;
}

export async function getLatestStageRuns(runId: string): Promise<StageRun[]> {
    const res = await getPool().query(`
        SELECT DISTINCT ON (stage_key) *
        FROM stage_runs
        WHERE run_id = $1
        ORDER BY stage_key, attempt DESC
    `, [runId]);
    return res.rows;
}

export async function createStageRun(runId: string, stageKey: string, attempt: number, stubPrompt: string, resolvedVarsJson: any = {}): Promise<StageRun> {
    const res = await getPool().query(`
        INSERT INTO stage_runs (run_id, stage_key, attempt, status, started_at, resolved_prompt, resolved_vars_json, resolved_image_inputs_json, output_json, produced_artifacts_json, error_json)
        VALUES ($1, $2, $3, 'running', now(), $4, $5, '[]', '{}', '[]', '{}')
        RETURNING *
    `, [runId, stageKey, attempt, stubPrompt, JSON.stringify(resolvedVarsJson)]);
    return res.rows[0];
}

export async function updateStageRunSuccess(id: string, outputJson: any, producedArtifactsJson: any = []): Promise<void> {
    await getPool().query(`
        UPDATE stage_runs 
        SET status = 'succeeded', ended_at = now(), output_json = $2, produced_artifacts_json = $3
        WHERE id = $1
    `, [id, JSON.stringify(outputJson), JSON.stringify(producedArtifactsJson)]);
}

export async function updateStageRunFailure(id: string, errorJson: any): Promise<void> {
    await getPool().query(`
        UPDATE stage_runs 
        SET status = 'failed', ended_at = now(), error_json = $2
        WHERE id = $1
    `, [id, JSON.stringify(errorJson)]);
}

export async function updateRunContext(runId: string, contextJson: any): Promise<void> {
    await getPool().query(`
        UPDATE runs SET context_json = $2, updated_at = now() WHERE id = $1
    `, [runId, contextJson]);
}

export async function updateRunStatus(runId: string, status: string, fields: Partial<Run> = {}): Promise<void> {
    const updates: string[] = [`status = $2`, `updated_at = now()`];
    const values: any[] = [runId, status];
    let idx = 3;

    if (fields.current_stage_key !== undefined) {
        updates.push(`current_stage_key = $${idx++}`);
        values.push(fields.current_stage_key);
    }
    if (fields.waiting_for_stage_key !== undefined) {
        updates.push(`waiting_for_stage_key = $${idx++}`);
        values.push(fields.waiting_for_stage_key);
    }
    if (fields.waiting_reason !== undefined) {
        updates.push(`waiting_reason = $${idx++}`);
        values.push(fields.waiting_reason);
    }
    if (fields.error_summary !== undefined) {
        updates.push(`error_summary = $${idx++}`);
        values.push(fields.error_summary);
    }

    await getPool().query(`UPDATE runs SET ${updates.join(', ')} WHERE id = $1`, values);
}

export async function emitRunEvent(runId: string, level: 'info' | 'warn' | 'error', message: string, data: any = {}) {
    await getPool().query(`
        INSERT INTO run_events (run_id, level, message, data_json)
        VALUES ($1, $2, $3, $4)
    `, [runId, level, message, data]);
}

async function emitRunEventTx(client: any, runId: string, level: string, message: string, data: any) {
    await client.query(`
        INSERT INTO run_events (run_id, level, message, data_json)
        VALUES ($1, $2, $3, $4)
    `, [runId, level, message, data]);
}
