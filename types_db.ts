export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            calendar_events: {
                Row: {
                    id: string
                    organization_id: string | null
                    contact_id: string | null
                    user_id: string | null
                    title: string
                    description: string | null
                    start_time: string
                    end_time: string
                    type: 'meeting' | 'follow_up' | 'call' | 'task' | null
                    status: 'scheduled' | 'completed' | 'cancelled' | null
                    reminder_minutes: number[] | null
                    reminder_sent: boolean | null
                    whatsapp_notification: boolean | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    organization_id?: string | null
                    contact_id?: string | null
                    user_id?: string | null
                    title: string
                    description?: string | null
                    start_time: string
                    end_time: string
                    type?: 'meeting' | 'follow_up' | 'call' | 'task' | null
                    status?: 'scheduled' | 'completed' | 'cancelled' | null
                    reminder_minutes?: number[] | null
                    reminder_sent?: boolean | null
                    whatsapp_notification?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    // ...
                }
            }
            contacts: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    phone: string
                    organization_id: string
                    whatsapp_id?: string | null
                    avatar_url?: string | null
                    source?: string | null
                    imported_at?: string | null
                }
                Insert: {
                    // ...
                }
                Update: {
                    // ...
                }
            }
            // ... other tables
        }
    }
}
