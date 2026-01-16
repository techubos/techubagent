
import React from 'react';
import { Target, Zap, Mail, Star, XCircle, UserPlus, CheckCircle } from 'lucide-react';
import { Lead } from '../api/useLeads';

interface LeadRowProps {
    lead: Lead;
    style: React.CSSProperties;
    selectedLeads: string[];
    toggleSelect: (id: string) => void;
    importLead: (lead: Lead) => void;
    discardLead: (id: string) => void;
}

export const LeadRow = ({ lead, style, selectedLeads, toggleSelect, importLead, discardLead }: LeadRowProps) => {
    return (
        <div style={style} className="px-2 py-2">
            <div className={`glass-card p-6 rounded-[2rem] border relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 ${selectedLeads.includes(lead.id) ? 'border-primary/50 bg-primary/5' : 'border-white/5 hover:border-white/10'}`}>

                {/* Selection Checkbox */}
                <div
                    onClick={() => toggleSelect(lead.id)}
                    className={`absolute top-6 right-6 w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all z-20 ${selectedLeads.includes(lead.id) ? 'bg-primary border-primary text-zinc-900' : 'border-white/10 hover:border-white/30 text-transparent'}`}
                >
                    <CheckCircle size={16} className={selectedLeads.includes(lead.id) ? 'scale-100' : 'scale-75'} />
                </div>

                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-black border border-white/5 flex items-center justify-center shadow-lg group-hover:shadow-primary/20 transition-all relative overflow-hidden">
                            <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay" />
                            <Target size={28} className="text-zinc-500 group-hover:text-primary transition-colors duration-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${lead.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                        lead.status === 'imported' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                            'bg-red-500/10 text-red-500 border-red-500/20'
                                    }`}>
                                    {lead.status === 'pending' ? 'TENTATIVA' : lead.status === 'imported' ? 'IMPORTADO' : 'DESCARTADO'}
                                </span>
                                <span className="text-xs text-zinc-500 font-medium">{new Date(lead.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 className="text-xl font-bold text-white leading-tight group-hover:text-primary transition-colors">{lead.name}</h3>
                            <div className="flex items-center gap-2 text-zinc-400 text-xs mt-1 font-medium">
                                <span>{lead.category}</span>
                                {lead.city && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <span>{lead.city}</span>
                                    </>
                                )}
                            </div>
                            {lead.website_summary && (
                                <p className="text-[10px] mt-1 text-emerald-400/70 italic line-clamp-1 border-t border-emerald-500/10 pt-1">
                                    ✨ {lead.website_summary}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-4 text-zinc-300">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-primary border border-border group-hover:border-primary/30 transition-all">
                            <Zap size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mb-1">WhatsApp / Telefone</p>
                            <p className="font-mono font-bold text-lg">{lead.phone || 'N/A'}</p>
                        </div>
                    </div>

                    {lead.email && (
                        <div className="flex items-center gap-4 text-zinc-300">
                            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-emerald-500 border border-border">
                                <Mail size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mb-1">E-mail de Contato</p>
                                <p className="text-sm font-bold truncate max-w-[200px]">{lead.email}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="mt-auto flex items-center justify-between pt-5 border-t border-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-yellow-500 font-black">
                            <Star size={16} fill="currentColor" />
                            <span>{lead.rating}</span>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{lead.reviewsCount} Reviews</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {lead.status === 'pending' && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); discardLead(lead.id); }}
                                    className="p-3 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                                    title="Descartar Lead"
                                >
                                    <XCircle size={24} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); importLead(lead); }}
                                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primaryHover text-zinc-900 font-black rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-95"
                                >
                                    <UserPlus size={20} />
                                    IMPORTAR
                                </button>
                            </>
                        )}
                        {lead.status === 'imported' && (
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                                <CheckCircle size={18} />
                                NO CRM
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
