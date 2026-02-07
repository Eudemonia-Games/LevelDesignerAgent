export interface FlowStageTemplate {
    id: string;
    flow_version_id: string;
    stage_key: string;
    order_index: number;
    kind: 'llm' | 'image' | 'model3d' | 'code';
    provider: string;
    model_id: string;
    prompt_template: string;
    attachments_policy_json: any;
    input_bindings_json: any;
    provider_config_json: any;
    output_schema_json: any;
    breakpoint_after: boolean;
    routing_rules_json?: any[]; // Keep as any[] or import RoutingRule? Any implies lazy.
}

export interface Run {
    id: string;
    flow_version_id: string;
    mode: 'express' | 'custom';
    status: 'queued' | 'running' | 'waiting_user' | 'succeeded' | 'failed' | 'cancelled';
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
    status: 'pending' | 'running' | 'waiting_user' | 'succeeded' | 'failed' | 'skipped' | 'stale';
    user_notes: string;
    started_at: Date | null;
    ended_at: Date | null;
    resolved_prompt: string;
    resolved_vars_json: any;
    resolved_image_inputs_json: any;
    output_json: any;
    produced_artifacts_json: any;
    error_json: any;
}
