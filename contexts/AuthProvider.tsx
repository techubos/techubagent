import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    [key: string]: any;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isSupabaseConfigured) {
            setLoading(false);
            return;
        }

        // 1. Load cached profile for instant restoration
        const cachedProfile = localStorage.getItem('techub_user_profile');
        if (cachedProfile) {
            try {
                setProfile(JSON.parse(cachedProfile));
                // Don't set loading to false yet, we still need to check session
            } catch (e) {
                console.warn('Malformed cached profile');
            }
        }

        // 2. Get initial session with timeout safety
        const initAuth = async () => {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 2000));

            try {
                const { data: { session } } = await Promise.race([
                    supabase.auth.getSession(),
                    timeoutPromise
                ]) as any;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // Profile fetching is moved to background if cached version exists
                    fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                    localStorage.removeItem('techub_user_profile');
                    setLoading(false);
                }
            } catch (error) {
                console.error('Auth initialization error or timeout:', error);
                setLoading(false);
            }
        };

        initAuth();

        // 3. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                if (!profile || profile.id !== session.user.id) {
                    fetchProfile(session.user.id);
                } else {
                    setLoading(false);
                }
            } else {
                setProfile(null);
                localStorage.removeItem('techub_user_profile');
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // 4. Heartbeat (Presence)
    useEffect(() => {
        if (!user) return;

        const updatePresence = async () => {
            await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', user.id);
        };

        const interval = setInterval(updatePresence, 60000); // Heartbeat every minute
        updatePresence(); // Initial call

        return () => clearInterval(interval);
    }, [user]);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Error fetching profile:', error);
            } else if (data) {
                setProfile(data);
                localStorage.setItem('techub_user_profile', JSON.stringify(data));
            }
        } catch (err) {
            console.error('Profile fetch exception:', err);
        } finally {
            // Only set loading false if we don't have a profile yet 
            // OR if this was the initial load
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
