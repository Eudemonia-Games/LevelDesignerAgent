import { Client } from 'pg';
import { getDbConfig } from './utils';

// --- Types ---

export interface FlowVersion {
    id: string;
    name: string;
    version_major: number;
    version_minor: number;
    version_patch: number;
    description: string;
    is_published: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface FlowStageTemplate {
    id: string;
    flow_version_id: string;
    stage_key: string;
    order_index: number;
    kind: string;
    provider: string;
    model_id: string;
    prompt_template: string;
    attachments_policy_json: any;
    input_bindings_json: any;
    provider_config_json: any;
    output_schema_json: any;
    breakpoint_after: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateFlowParams {
    name: string;
    version_major: number;
    version_minor: number;
    version_patch: number;
    description: string;
}

export interface UpdateFlowParams {
    id: string;
    description?: string;
    name?: string;
}

export interface UpsertStageParams {
    flow_version_id: string;
    stage_key: string;
    order_index?: number; // Required for create
    kind?: string;        // Required for create
    provider?: string;    // Required for create
    model_id?: string;
    prompt_template?: string;
    attachments_policy_json?: any;
    input_bindings_json?: any;
    provider_config_json?: any;
    output_schema_json?: any;
    breakpoint_after?: boolean;
}

// --- Service ---

export const FlowsDb = {
    async getClient(): Promise<Client> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DB not configured");
        const client = new Client(getDbConfig(dbUrl));
        await client.connect();
        return client;
    },

    async listFlows(): Promise<FlowVersion[]> {
        const client = await this.getClient();
        try {
            const res = await client.query(`
                SELECT * FROM flow_versions 
                ORDER BY name ASC, version_major DESC, version_minor DESC, version_patch DESC
            `);
            return res.rows;
        } finally {
            await client.end();
        }
    },

    async createFlow(params: CreateFlowParams): Promise<FlowVersion> {
        const client = await this.getClient();
        try {
            const res = await client.query(`
                INSERT INTO flow_versions (name, version_major, version_minor, version_patch, description)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [params.name, params.version_major, params.version_minor, params.version_patch, params.description]);
            return res.rows[0];
        } finally {
            await client.end();
        }
    },

    async getFlowById(id: string): Promise<FlowVersion | null> {
        const client = await this.getClient();
        try {
            const res = await client.query(`SELECT * FROM flow_versions WHERE id = $1`, [id]);
            return res.rows[0] || null;
        } finally {
            await client.end();
        }
    },

    async updateFlow(params: UpdateFlowParams): Promise<FlowVersion | null> {
        const client = await this.getClient();
        try {
            const updates: string[] = [];
            const values: any[] = [params.id];
            let idx = 2;

            if (params.description !== undefined) {
                updates.push(`description = $${idx++}`);
                values.push(params.description);
            }
            if (params.name !== undefined) {
                updates.push(`name = $${idx++}`);
                values.push(params.name);
            }

            if (updates.length === 0) {
                return this.getFlowById(params.id);
            }

            updates.push(`updated_at = now()`);

            const res = await client.query(`
                UPDATE flow_versions 
                SET ${updates.join(', ')} 
                WHERE id = $1 
                RETURNING *
            `, values);
            return res.rows[0] || null;
        } finally {
            await client.end();
        }
    },

    async cloneFlow(sourceId: string): Promise<FlowVersion | null> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');

            // 1. Get Source
            const sourceRes = await client.query(`SELECT * FROM flow_versions WHERE id = $1`, [sourceId]);
            const source = sourceRes.rows[0];
            if (!source) {
                await client.query('ROLLBACK');
                return null;
            }

            // 2. Determine new version (Option A: Max Patch + 1)
            const maxPatchRes = await client.query(`
                SELECT MAX(version_patch) as max_patch 
                FROM flow_versions 
                WHERE name = $1 AND version_major = $2 AND version_minor = $3
            `, [source.name, source.version_major, source.version_minor]);

            const nextPatch = (maxPatchRes.rows[0].max_patch ?? source.version_patch) + 1;

            // 3. Insert New Flow
            const newFlowRes = await client.query(`
                INSERT INTO flow_versions (name, version_major, version_minor, version_patch, description, is_published)
                VALUES ($1, $2, $3, $4, $5, false)
                RETURNING *
            `, [source.name, source.version_major, source.version_minor, nextPatch, `Clone of ${source.name} v${source.version_major}.${source.version_minor}.${source.version_patch}`]);
            const newFlow = newFlowRes.rows[0];

            // 4. Clone Stages
            await client.query(`
                INSERT INTO flow_stage_templates 
                (flow_version_id, stage_key, order_index, kind, provider, model_id, prompt_template, attachments_policy_json, input_bindings_json, provider_config_json, output_schema_json, breakpoint_after)
                SELECT $1, stage_key, order_index, kind, provider, model_id, prompt_template, attachments_policy_json, input_bindings_json, provider_config_json, output_schema_json, breakpoint_after
                FROM flow_stage_templates
                WHERE flow_version_id = $2
            `, [newFlow.id, sourceId]);

            await client.query('COMMIT');
            return newFlow;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            await client.end();
        }
    },

    async publishFlow(id: string): Promise<FlowVersion | null> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');

            const flowRes = await client.query(`SELECT name FROM flow_versions WHERE id = $1`, [id]);
            if (!flowRes.rows[0]) {
                await client.query('ROLLBACK');
                return null;
            }
            const name = flowRes.rows[0].name;

            // Unpublish others with same name
            await client.query(`UPDATE flow_versions SET is_published = false WHERE name = $1 AND id != $2`, [name, id]);

            // Publish target
            const res = await client.query(`
                UPDATE flow_versions SET is_published = true, updated_at = now() WHERE id = $1 RETURNING *
            `, [id]);

            await client.query('COMMIT');
            return res.rows[0];
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            await client.end();
        }
    },

    // --- Stages ---

    async listStages(flowId: string): Promise<FlowStageTemplate[]> {
        const client = await this.getClient();
        try {
            const res = await client.query(`
                SELECT * FROM flow_stage_templates 
                WHERE flow_version_id = $1 
                ORDER BY order_index ASC
            `, [flowId]);
            return res.rows;
        } finally {
            await client.end();
        }
    },

    async upsertStage(params: UpsertStageParams): Promise<FlowStageTemplate> {
        const client = await this.getClient();
        try {
            // Check existence
            const existingRes = await client.query(`
                SELECT id FROM flow_stage_templates WHERE flow_version_id = $1 AND stage_key = $2
            `, [params.flow_version_id, params.stage_key]);

            const exists = existingRes.rows.length > 0;

            if (exists) {
                // Update
                const updates: string[] = [];
                const values: any[] = [params.flow_version_id, params.stage_key];
                let idx = 3;

                const fields: (keyof UpsertStageParams)[] = [
                    'order_index', 'kind', 'provider', 'model_id', 'prompt_template',
                    'attachments_policy_json', 'input_bindings_json', 'provider_config_json',
                    'output_schema_json', 'breakpoint_after'
                ];

                for (const field of fields) {
                    if (params[field] !== undefined) {
                        updates.push(`${field} = $${idx++}`);
                        values.push(params[field]);
                    }
                }

                updates.push(`updated_at = now()`);

                const res = await client.query(`
                    UPDATE flow_stage_templates 
                    SET ${updates.join(', ')} 
                    WHERE flow_version_id = $1 AND stage_key = $2
                    RETURNING *
                `, values);
                return res.rows[0];
            } else {
                // Insert
                // Require minimal fields
                if (params.order_index === undefined || !params.kind || !params.provider) {
                    throw new Error("Missing required fields for new stage (order_index, kind, provider)");
                }

                const res = await client.query(`
                    INSERT INTO flow_stage_templates 
                    (flow_version_id, stage_key, order_index, kind, provider, model_id, prompt_template, attachments_policy_json, input_bindings_json, provider_config_json, output_schema_json, breakpoint_after)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING *
                `, [
                    params.flow_version_id, params.stage_key, params.order_index, params.kind, params.provider,
                    params.model_id ?? '', params.prompt_template ?? '',
                    params.attachments_policy_json ?? {}, params.input_bindings_json ?? {}, params.provider_config_json ?? {}, params.output_schema_json ?? {},
                    params.breakpoint_after ?? false
                ]);
                return res.rows[0];
            }
        } finally {
            await client.end();
        }
    }
};
