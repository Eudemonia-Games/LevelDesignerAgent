import { Client } from 'pg';
import { getDbConfig } from './utils';

export interface Run {
    id: string;
    flow_version_id: string;
    status: string;
    mode: string;
    user_prompt: string;
    seed: number;
    context_json: any;
    current_stage_key: string | null;
    waiting_for_stage_key: string | null;
    waiting_reason: string | null;
    error_summary: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface StageRun {
    id: string;
    run_id: string;
    stage_key: string;
    attempt: number;
    status: string;
    started_at: Date;
    ended_at: Date | null;
    resolved_prompt: string;
    resolved_vars_json: any;
    resolved_image_inputs_json: any;
    output_json: any;
    produced_artifacts_json: any;
    error_json: any;
    created_at: Date;
}

export interface RunEvent {
    id: string;
    run_id: string;
    level: string;
    message: string;
    data_json: any;
    created_at: Date;
}

export interface CreateRunParams {
    flow_version_id: string;
    user_prompt: string;
    mode: 'express' | 'custom';
    seed?: number;
}

export interface ListRunsParams {
    limit?: number;
    offset?: number;
}

export const RunsDb = {
    async getClient(): Promise<Client> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");
        const client = new Client(getDbConfig(dbUrl));
        await client.connect();
        return client;
    },

    async createRun(params: CreateRunParams): Promise<Run> {
        const client = await this.getClient();
        try {
            const seed = params.seed ?? Math.floor(Math.random() * 1000000);
            const res = await client.query(`
                INSERT INTO runs (flow_version_id, user_prompt, mode, seed, status, context_json)
                VALUES ($1, $2, $3, $4, 'queued', '{}')
                RETURNING *
            `, [params.flow_version_id, params.user_prompt, params.mode, seed]);
            return res.rows[0];
        } finally {
            await client.end();
        }
    },

    async listRuns(params: ListRunsParams = {}): Promise<Run[]> {
        const client = await this.getClient();
        try {
            const limit = params.limit ?? 50;
            const offset = params.offset ?? 0;

            const res = await client.query(`
                SELECT * FROM runs 
                ORDER BY created_at DESC 
                LIMIT $1 OFFSET $2
            `, [limit, offset]);
            return res.rows;
        } finally {
            await client.end();
        }
    },

    async getRunById(id: string): Promise<Run | null> {
        const client = await this.getClient();
        try {
            const res = await client.query(`SELECT * FROM runs WHERE id = $1`, [id]);
            return res.rows[0] || null;
        } finally {
            await client.end();
        }
    },

    async getStageRuns(runId: string): Promise<StageRun[]> {
        const client = await this.getClient();
        try {
            const res = await client.query(`
                SELECT * FROM stage_runs 
                WHERE run_id = $1 
                ORDER BY created_at ASC
            `, [runId]);
            return res.rows;
        } finally {
            await client.end();
        }
    },

    async getRunEvents(runId: string): Promise<RunEvent[]> {
        const client = await this.getClient();
        try {
            const res = await client.query(`
                SELECT * FROM run_events 
                WHERE run_id = $1 
                ORDER BY created_at ASC
            `, [runId]);
            return res.rows;
        } finally {
            await client.end();
        }
    },

    async resumeRun(id: string): Promise<void> {
        const client = await this.getClient();
        try {
            await client.query(`
                UPDATE runs 
                SET status = 'queued', waiting_reason = NULL, waiting_for_stage_key = NULL, updated_at = now()
                WHERE id = $1 AND status = 'waiting_user'
            `, [id]);
        } finally {
            await client.end();
        }
    },

    async deleteRun(id: string): Promise<boolean> {
        const client = await this.getClient();
        try {
            const res = await client.query("DELETE FROM runs WHERE id = $1", [id]);
            return (res.rowCount || 0) > 0;
        } finally {
            await client.end();
        }
    }
};
