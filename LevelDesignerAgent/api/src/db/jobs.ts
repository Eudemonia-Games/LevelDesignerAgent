import { Client } from 'pg';
import { getDbConfig } from './utils';

export interface Job {
    id: string;
    type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    payload: any;
    result: any;
    error: string | null;
    created_at: string;
    updated_at: string;
}

export const JobsDb = {
    async createJob(type: string, payload: any): Promise<Job> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");

        const client = new Client(getDbConfig(dbUrl));
        try {
            await client.connect();
            const res = await client.query(`
                INSERT INTO jobs (type, payload, status)
                VALUES ($1, $2, 'pending')
                RETURNING *
            `, [type, payload]);
            return res.rows[0];
        } finally {
            await client.end();
        }
    },

    async getJob(id: string): Promise<Job | null> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");

        const client = new Client(getDbConfig(dbUrl));
        try {
            await client.connect();
            const res = await client.query(`
                SELECT * FROM jobs WHERE id = $1
            `, [id]);
            return res.rows[0] || null;
        } finally {
            await client.end();
        }
    }
};
