export interface FlowVersion {
    id: string;
    name: string;
    version_major: number;
    version_minor: number;
    version_patch: number;
    description: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
}

export type ProviderKind = 'llm' | 'image' | 'model3d' | 'code';
export type ProviderId = 'openai' | 'gemini' | 'fal' | 'meshy' | 'rodin' | 'internal';

export interface RoutingRule {
    id: string;
    condition_expression: string; // e.g. "context.score > 5"
    next_stage_key: string;
    priority: number;
}

export interface FlowStageTemplate {
    id: string;
    flow_version_id: string;
    stage_key: string;
    order_index: number;
    kind: ProviderKind;
    provider: ProviderId;
    model_id: string;
    prompt_template: string;
    attachments_policy_json: Record<string, any>;
    input_bindings_json: Record<string, any>;
    provider_config_json: Record<string, any>;
    output_schema_json: Record<string, any>;
    breakpoint_after: boolean;
    routing_rules_json: RoutingRule[];
    created_at: string;
    updated_at: string;
}
