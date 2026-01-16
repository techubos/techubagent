import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { CalendarView } from '../components/calendar/CalendarView';
import { Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';

export function CalendarPage() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session?.user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', session.user.id)
                    .single();

                setOrgId(profile?.organization_id || null);
            }
            setLoading(false);
        };
        init();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <Layout>
            <div className="h-full p-4 flex flex-col">
                <div className="mb-6">
                    <h1 className="text-3xl font-black text-white tracking-tighter">Agenda & Eventos</h1>
                    <p className="text-zinc-500 font-medium">Gerencie reuniões, follow-ups e tarefas da sua equipe.</p>
                </div>

                {orgId && session?.user?.id ? (
                    <CalendarView organizationId={orgId} userId={session.user.id} />
                ) : (
                    <div className="text-white">Erro ao carregar organização.</div>
                )}
            </div>
        </Layout>
    );
}
