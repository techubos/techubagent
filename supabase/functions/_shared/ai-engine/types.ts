export interface AIContext {
    contactId: string;
    organizationId: string;
    userMessage: string;
    history: any[]; // Extended as needed
}

export interface Intent {
    name: 'greeting' | 'question' | 'complaint' | 'pricing' | 'scheduling' | 'human_request' | 'other';
    confidence: number;
}

export interface AIRule {
    id: string;
    name: string;
    trigger_keywords: string[];
    condition_type: 'always' | 'if_contains' | 'if_time' | 'if_contact_tag';
    condition_value: any;
    action_type: 'respond' | 'transfer_human' | 'execute_function' | 'send_template';
    action_value: string;
    priority: number;
}

export interface AIMemory {
    key: string;
    value: string;
    confidence: number;
}

export interface AIResponse {
    message: string;
    action?: 'respond' | 'transfer_human' | 'none';
    confidence?: number;
    metadata?: any;
}

export interface AIAgent {
    id: string;
    organization_id: string;
    name: string;
    model: string;
    personality: string;
    custom_instructions: string;
    confidence_threshold: number;
    simulate_typing: boolean;
    typing_wpm: number;
    split_messages: boolean;
    chunks_delay_ms: number;
    is_active: boolean;
    is_default: boolean;
}
