
export interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
  timestamp: number;
  created_at?: string;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document';
  audioUrl?: string;
  mediaUrl?: string;
  transcription?: string;
  audioDuration?: number;
  is_from_me?: boolean;
  whatsapp_message_id?: string;
  payload?: any;
  status?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  company?: string;
  status: string;
  notes: string;
  evolution_id?: string;
  last_message_at?: string;
  priority?: 'high' | 'medium' | 'low';
  lead_score?: number;
  lead_temperature?: 'cold' | 'warm' | 'hot';
  sentiment?: 'positive' | 'neutral' | 'angry';
  next_action_suggestion?: string;
  next_best_action?: string;
  lead_category?: string;
  tags?: string[];
  active_workflow_id?: string;
  last_workflow_step?: number;
  human_intervention?: boolean;
  user_id?: string;
  profile_pic_url?: string;
  last_message_from_me?: boolean;
  last_interaction_at?: string;
  is_unread?: boolean;
  handling_mode?: 'ai' | 'human';
  summary?: string;
}

export interface Agent {
  id: string;
  name: string;
  connection_id?: string;
  model: string;
  system_prompt: string;
  temperature: number;

  // Habilidades
  supports_audio: boolean;
  supports_image: boolean;
  transcribe_audio: boolean;

  // Comportamento
  typing_simulation?: boolean; // Aparecer digitando...
  pause_on_human?: boolean; // Pausar se humano intervir
  group_messages?: boolean; // Agrupar mensagens curtas
  history_limit?: number; // Quantidade de msgs no histórico
  split_messages?: boolean; // Dividir mensagens por quebra de linha
  message_delay?: number; // Atraso entre mensagens (s)


  // CRM Config
  crm_board_id?: string;
  crm_stage_id?: string;
  crm_default_value?: number;
  crm_default_note?: string;

  created_at?: string;
  user_id?: string;
  is_active?: boolean;
  ignore_groups?: boolean;
  document_ids?: string[];
  auto_learn?: boolean;

  // New Control Fields
  human_pause_hours?: number;
  audience_type?: 'all' | 'new_leads' | 'unreplied';
  unreplied_timeout_hours?: number;

  flow_id?: string;
  anti_repetition_enabled?: boolean;
}

export interface Connection {
  id: string;
  name: string;
  instance_name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  phone_number?: string;
  user_id?: string;
}

export interface Broadcast {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string;
  message_template: string;
  tags: string[];

  is_ab_test?: boolean;
  is_ai_generated?: boolean;

  message_template_b?: string;

  // Configurações Avançadas (V2)
  connection_id?: string;
  target_type: 'contacts' | 'groups';
  target_contact_ids?: string[];
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';

  config_interval_min?: number;
  config_interval_max?: number;
  config_batch_size?: number;
  config_batch_delay?: number;

  config_start_time?: string;
  config_end_time?: string;
  config_days?: string[];
}

export interface AutomationWorkflow {
  id: string;
  title: string;
  description: string;
  trigger_type: 'no_reply' | 'status_change' | 'schedule_approaching';
  trigger_condition: string;
  active: boolean;
  steps: AutomationStep[];
  stats: {
    active_contacts: number;
    converted: number;
  }
}

export interface AutomationStep {
  order: number;
  type: 'message' | 'wait' | 'check_condition';
  content?: string;
  delay?: number;
}

export interface UserMemory {
  userName?: string;
  userCompany?: string;
  userRole?: string;
  painPoints: string[];
  preferences: string[];
  lastIntent?: string;
  operationalStatus?: 'lead' | 'negotiation' | 'closed' | 'support' | 'client';
}

export interface AgentSettings {
  name: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  defaultProvider?: 'openai' | 'gemini' | 'groq' | 'anthropic' | 'glm';
  // Novas chaves de API
  apiKeys: {
    openai?: string;
    gemini?: string;
    groq?: string;
    anthropic?: string;
    glm?: string;
  };
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: 'text' | 'pdf' | 'faq';
  active: boolean;
}

export interface CRMColumn {
  id: string;
  title: string;
  color: string;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  CRM = 'CRM',
  CHAT_SIMULATOR = 'CHAT_SIMULATOR',
  PLAYBOOKS = 'PLAYBOOKS',
  KNOWLEDGE = 'KNOWLEDGE',
  AGENTS = 'AGENTS',
  SETTINGS = 'SETTINGS',
  AUTOMATIONS = 'AUTOMATIONS',
  BROADCASTS = 'BROADCASTS',
  GUIDE = 'GUIDE',
  ROADMAP = 'ROADMAP',
  INTEGRATION = 'INTEGRATION',
  EXPERIMENTS = 'EXPERIMENTS',
  PROSPECTING = 'PROSPECTING',
  PROSPECTING_CAMPAIGNS = 'PROSPECTING_CAMPAIGNS',
  LIVE_CHAT = 'LIVE_CHAT',
  TEAM = 'TEAM',
  GUARDIAN = 'GUARDIAN',
  ANALYTICS = 'ANALYTICS',
  INTELLIGENCE_BI = 'INTELLIGENCE_BI',
  SEQUENCES = 'SEQUENCES',
  FLOWS = 'FLOWS',
  AUDIT = 'AUDIT',
  SAAS_ADMIN = 'SAAS_ADMIN',
  INTERNAL_CHAT = 'INTERNAL_CHAT',
  HELP_CENTER = 'HELP_CENTER',
  DATABASE_MANAGER = 'DATABASE_MANAGER',
  SCHEDULING = 'SCHEDULING',
  QUICK_RESPONSES = 'QUICK_RESPONSES'
}

export interface SystemHealth {
  id: string;
  organization_id: string;
  component: 'evolution' | 'chatwoot' | 'webhook' | 'processor' | 'ai';
  status: 'healthy' | 'degraded' | 'down';
  last_success?: string;
  last_error?: string;
  error_count: number;
  updated_at: string;
}