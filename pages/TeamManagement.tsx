
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    Users,
    Shield,
    Mail,
    Clock,
    MoreVertical,
    UserPlus,
    Search,
    BadgeCheck,
    Power,
    Smartphone
} from 'lucide-react';

interface Profile {
    id: string;
    full_name: string;
    role: 'admin' | 'agent';
    is_online: boolean;
    personal_phone?: string;
    department?: string;
    updated_at: string;
}

export const TeamManagement = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*').order('full_name');
        if (data) setProfiles(data);
        setLoading(false);
    };

    const updatePhone = async (id: string, phone: string) => {
        const { error } = await supabase.from('profiles').update({ personal_phone: phone }).eq('id', id);
        if (!error) fetchProfiles();
    };

    const updateDepartment = async (id: string, department: string) => {
        const { error } = await supabase.from('profiles').update({ department }).eq('id', id);
        if (!error) fetchProfiles();
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">Minha Equipe</h1>
                    <p className="text-zinc-500 font-medium">Gerencie atendentes e permissões de acesso.</p>
                </div>
                <button className="bg-primary-gradient text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-emerald-900/20 transition-all transform active:scale-95 hover:opacity-90">
                    <UserPlus size={20} />
                    CONVIDAR AGENTE
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-border p-6 rounded-3xl relative overflow-hidden">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Total de Agentes</p>
                    <h2 className="text-4xl font-black text-white">{profiles.length}</h2>
                </div>
                <div className="bg-surface border border-border p-6 rounded-3xl relative overflow-hidden text-emerald-500">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Online Agora</p>
                    <h2 className="text-4xl font-black">{profiles.filter(p => p.is_online).length}</h2>
                </div>
                <div className="bg-surface border border-border p-6 rounded-3xl relative overflow-hidden">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Aguardando Aprovação</p>
                    <h2 className="text-4xl font-black text-zinc-700">0</h2>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between bg-zinc-900/50">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou e-mail..."
                            className="w-full bg-zinc-900 border border-border rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-zinc-900/50 text-left">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Atendente</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Cargo</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Departamento</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">WhatsApp Notificações</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {profiles.map(agent => (
                                <tr key={agent.id} className="hover:bg-zinc-800/20 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 border border-zinc-700 font-bold uppercase transition-all group-hover:border-primary/50 group-hover:text-primary">
                                                {agent.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white mb-0.5">{agent.full_name || 'Usuário sem Nome'}</p>
                                                <p className="text-[10px] text-zinc-500 font-mono italic">ID: {agent.id.slice(0, 8)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${agent.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {agent.role === 'admin' ? <Shield size={12} /> : <Users size={12} />}
                                            {agent.role === 'admin' ? 'Admin' : 'Atendente'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <select
                                            value={agent.department || 'Vendas'}
                                            onChange={(e) => updateDepartment(agent.id, e.target.value)}
                                            className="bg-zinc-900 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-400 outline-none focus:border-primary transition-all"
                                        >
                                            <option value="Vendas">Vendas</option>
                                            <option value="Suporte">Suporte</option>
                                            <option value="Financeiro">Financeiro</option>
                                            <option value="Marketing">Marketing</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={14} className="text-zinc-500" />
                                            <input
                                                type="text"
                                                defaultValue={agent.personal_phone || ''}
                                                onBlur={(e) => updatePhone(agent.id, e.target.value)}
                                                placeholder="Adicionar número..."
                                                className="bg-transparent border-none text-xs font-mono text-zinc-300 focus:ring-0 w-32 placeholder:text-zinc-700"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${agent.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                                            <span className={`text-xs font-bold uppercase tracking-tight ${agent.is_online ? 'text-emerald-500' : 'text-zinc-600'}`}>
                                                {agent.is_online ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button className="text-zinc-600 hover:text-white transition-colors">
                                            <MoreVertical size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
