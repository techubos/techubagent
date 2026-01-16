import { supabase } from '../services/supabaseClient';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogOptions {
    level: LogLevel;
    component: string;
    message: string;
    metadata?: Record<string, any>;
    organizationId?: string;
    userId?: string;
}

/**
 * Centralized logging helper for TecHub Agent.
 * Synchronizes logs to the app_logs table and console.
 */
export async function log(options: LogOptions) {
    const {
        level = 'info',
        component,
        message,
        metadata = {},
        organizationId,
        userId
    } = options;

    try {
        const { error } = await supabase.from('app_logs').insert({
            level,
            component,
            message,
            metadata,
            organization_id: organizationId,
            user_id: userId
        });

        if (error) {
            console.error('❌ Failed to save log to Supabase:', error.message);
        }

        // Console output for development and debugging
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;

        switch (level) {
            case 'debug':
                console.debug(logMsg, metadata);
                break;
            case 'warn':
                console.warn(logMsg, metadata);
                break;
            case 'error':
            case 'critical':
                console.error(logMsg, metadata);
                break;
            default:
                console.log(logMsg, metadata);
        }
    } catch (err) {
        console.error('💥 Critical logger error:', err);
    }
}

// Specialized helpers for convenience
export const logger = {
    debug: (component: string, message: string, metadata?: any, orgId?: string) =>
        log({ level: 'debug', component, message, metadata, organizationId: orgId }),
    info: (component: string, message: string, metadata?: any, orgId?: string) =>
        log({ level: 'info', component, message, metadata, organizationId: orgId }),
    warn: (component: string, message: string, metadata?: any, orgId?: string) =>
        log({ level: 'warn', component, message, metadata, organizationId: orgId }),
    error: (component: string, message: string, metadata?: any, orgId?: string) =>
        log({ level: 'error', component, message, metadata, organizationId: orgId }),
    critical: (component: string, message: string, metadata?: any, orgId?: string) =>
        log({ level: 'critical', component, message, metadata, organizationId: orgId }),
};
