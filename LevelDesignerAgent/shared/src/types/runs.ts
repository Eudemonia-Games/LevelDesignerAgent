export type RunMode = 'express' | 'custom';
export type RunStatus = 'queued' | 'running' | 'waiting_user' | 'succeeded' | 'failed' | 'cancelled';
export type StageStatus = 'pending' | 'running' | 'waiting_user' | 'succeeded' | 'failed' | 'skipped' | 'stale';

export interface Run {
    id: string;
    flow_version_id: string;
    mode: RunMode;
    status: RunStatus;
    user_prompt: string;
    seed: number;
    context_json: Record<string, any>;
    current_stage_key: string | null;
    waiting_for_stage_key: string | null;
    waiting_reason: string | null;
    error_summary: string | null;
    created_at: string;
    updated_at: string;
}

export interface StageRun {
    id: string;
    run_id: string;
    stage_key: string;
    attempt: number;
    status: StageStatus;
    user_notes: string;
    started_at: string | null;
    ended_at: string | null;
    resolved_prompt: string;
    resolved_vars_json: Record<string, any>;
    resolved_image_inputs_json: any[];
    output_json: Record<string, any>;
    produced_artifacts_json: any[];
    error_json: Record<string, any>;
}

export interface RunEvent {
    id: string;
    run_id: string;
    stage_key: string | null;
    level: string;
    message: string;
    data_json: Record<string, any>;
    created_at: string;
}
