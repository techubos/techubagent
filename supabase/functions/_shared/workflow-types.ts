
export type NodeType =
    | 'trigger'
    | 'condition'
    | 'send_message'
    | 'send_media'
    | 'ai_generate'
    | 'ai_classify'
    | 'ai_extract'
    | 'crm_create_contact'
    | 'crm_update_contact'
    | 'crm_add_tag'
    | 'integration_http'
    | 'integration_email'
    | 'control_delay'
    | 'control_loop'
    | 'control_stop'
    | 'data_set_variable'
    | 'data_get_variable'
    | 'handoff_to_human'
    | 'handoff_notify';

export interface BaseNode {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, any>;
}

export interface SendMessageNode extends BaseNode {
    type: 'send_message';
    data: {
        message: string;
        delay?: number;
        typing?: boolean;
    };
}

export interface ConditionNode extends BaseNode {
    type: 'condition';
    data: {
        conditions: Array<{
            field: string;
            operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'regex';
            value: string | number;
            case_sensitive?: boolean;
        }>;
        logic: 'AND' | 'OR';
    };
}

export interface Workflow {
    id: string;
    name: string;
    nodes: BaseNode[];
    edges: any[];
    organization_id: string;
    status: 'draft' | 'active' | 'paused';
}
