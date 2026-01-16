export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface ComponentStatus {
    id: string;
    component: string;
    status: HealthStatus;
    response_time_ms: number;
    last_success?: string;
    last_error?: string;
    updated_at: string;
    uptime_24h?: number;
}

export interface IncidentLog {
    id: string;
    component: string;
    status: HealthStatus;
    duration_minutes?: number;
    error_message?: string;
    checked_at: string;
    resolved: boolean;
}


export interface JobStats {
    pending: number;
    completed: number;
    failed: number;
}

export interface HealthMetric {
    timestamp: string;
    [key: string]: number | string; // Dynamic component names
}
