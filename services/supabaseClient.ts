import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = supabaseUrl !== '' && supabaseKey !== '';

if (!isSupabaseConfigured) {
    console.warn("Supabase keys missing! App will render Setup screen.");
}

// Use placeholders to prevent crash during import if keys are missing
// The App component will block usage if isSupabaseConfigured is false
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
);