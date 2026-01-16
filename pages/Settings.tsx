import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Settings as SettingsIcon,
  Globe,
  Smartphone,
  Key,
  Clock,
  Bell,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Mail,
  Power
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import { fetchQRCode, checkInstanceStatus, createInstance, logoutInstance } from '../services/evolutionService';

// --- Zod Schemas ---

const businessHoursSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string(),
  schedule: z.record(z.string(), z.object({
    open: z.string(),
    close: z.string(),
    active: z.boolean()
  })).nullable()
});

const notificationSettingsSchema = z.object({
  email_new_message: z.boolean(),
  email_critical_error: z.boolean(),
  destination_email: z.string().email().or(z.literal(''))
});

const settingsSchema = z.object({
  // General
  name: z.string().min(1, 'Nome da organização é obrigatório'),
  slug: z.string().optional(),
  timezone: z.string(),
  language: z.enum(['pt-BR', 'en', 'es']),
  logo_url: z.string().url().or(z.literal('')),

  // Integrations
  chatwoot_enabled: z.boolean(),
  chatwoot_url: z.string().url().or(z.literal('')),
  chatwoot_api_key: z.string().or(z.literal('')),
  ai_active: z.boolean(),
  openai_api_key: z.string().or(z.literal('')),

  // Hours
  business_hours: businessHoursSchema,

  // Notifications
  notification_settings: notificationSettingsSchema
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SettingsProps {
  settings: any;
  onSave: (s: any) => void;
}

export function Settings({ settings: initialSettings, onSave: onLegacySave }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'geral' | 'whatsapp' | 'integrations' | 'hours' | 'notifications'>('geral');
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      ai_active: true,
      chatwoot_enabled: false,
      business_hours: { enabled: true, timezone: 'America/Sao_Paulo', schedule: null },
      notification_settings: { email_new_message: false, email_critical_error: true, destination_email: '' }
    }
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) return;
      setOrgId(profile.organization_id);

      const [orgRes, settingsRes, connRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', profile.organization_id).single(),
        supabase.from('organization_settings').select('*').eq('organization_id', profile.organization_id).maybeSingle(),
        supabase.from('connections').select('*').eq('organization_id', profile.organization_id)
      ]);

      if (orgRes.data) {
        reset({
          name: orgRes.data.name || '',
          slug: orgRes.data.slug || '',
          timezone: orgRes.data.timezone || 'America/Sao_Paulo',
          language: orgRes.data.language || 'pt-BR',
          logo_url: orgRes.data.logo_url || '',
          business_hours: orgRes.data.business_hours || {
            enabled: true,
            timezone: 'America/Sao_Paulo',
            schedule: {
              monday: { open: '09:00', close: '18:00', active: true },
              tuesday: { open: '09:00', close: '18:00', active: true },
              wednesday: { open: '09:00', close: '18:00', active: true },
              thursday: { open: '09:00', close: '18:00', active: true },
              friday: { open: '09:00', close: '18:00', active: true },
              saturday: { open: '09:00', close: '13:00', active: true },
              sunday: { open: '09:00', close: '18:00', active: false }
            }
          },
          notification_settings: orgRes.data.notification_settings || { email_new_message: false, email_critical_error: true, destination_email: '' },
          chatwoot_enabled: orgRes.data.chatwoot_enabled || false,

          // These come from organization_settings
          chatwoot_url: settingsRes.data?.chatwoot_url || '',
          chatwoot_api_key: settingsRes.data?.chatwoot_api_key || '',
          ai_active: !!settingsRes.data?.openai_api_key,
          openai_api_key: settingsRes.data?.openai_api_key || ''
        });
      }

      setConnections(connRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: SettingsFormData) => {
    if (!orgId) return;
    setLoading(true);

    try {
      // 1. Update Organizations
      const { error: orgError } = await supabase.from('organizations').update({
        name: formData.name,
        timezone: formData.timezone,
        language: formData.language,
        logo_url: formData.logo_url,
        business_hours: formData.business_hours,
        notification_settings: formData.notification_settings,
        chatwoot_enabled: formData.chatwoot_enabled
      }).eq('id', orgId);

      if (orgError) throw orgError;

      // 2. Update Organization Settings
      const { error: settingsError } = await supabase.from('organization_settings').upsert({
        organization_id: orgId,
        timezone: formData.timezone,
        language: formData.language,
        chatwoot_url: formData.chatwoot_url,
        chatwoot_api_key: formData.chatwoot_api_key,
        openai_api_key: formData.openai_api_key,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id' });

      if (settingsError) throw settingsError;

      toast.success("Configurações salvas com sucesso!");
      fetchInitialData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleNewConnection = async () => {
    setIsConnecting(true);
    try {
      const instanceName = `org_${orgId?.substring(0, 8)}`;
      const config = { instanceName, serverUrl: '', apiKey: '' };

      const res = await createInstance(config);
      if (res) {
        // PERISTENCE FIX: Save connection to DB immediately
        await supabase.from('connections').upsert({
          organization_id: orgId,
          instance_name: instanceName,
          status: 'connecting', // Temporary status
          name: instanceName
        }, { onConflict: 'instance_name' });

        const qrRes = await fetchQRCode(config);
        if (qrRes?.base64) {
          setQrCode(qrRes.base64);
        }
      }
    } catch (err) {
      toast.error("Erro ao criar conexão");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (instanceName: string) => {
    if (!confirm("Confirmar desconexão do WhatsApp?")) return;
    try {
      await logoutInstance({ instanceName, serverUrl: '', apiKey: '' });
      await supabase.from('connections').delete().eq('instance_name', instanceName);
      toast.success("WhatsApp desconectado");
      fetchInitialData();
    } catch (err) {
      toast.error("Erro ao desconectar");
    }
  };

  if (loading && !orgId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <SettingsIcon className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Configurações do Admin</h1>
          <p className="text-zinc-500 font-medium">Gerencie sua operação, integrações e notificações centralizadas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { id: 'geral', icon: Globe, label: 'Geral' },
            { id: 'whatsapp', icon: Smartphone, label: 'WhatsApp' },
            { id: 'integrations', icon: Key, label: 'Integrações' },
            { id: 'hours', icon: Clock, label: 'Atendimento' },
            { id: 'notifications', icon: Bell, label: 'Notificações' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all
                ${activeTab === tab.id ? 'bg-primary text-zinc-950 shadow-xl shadow-primary/20 scale-105' : 'text-zinc-500 hover:text-white hover:bg-white/5'}
              `}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl min-h-[500px]">

              {/* Tab: Geral */}
              {activeTab === 'geral' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                  <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest text-xs opacity-50">Dados da Conta</h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome da Organização</label>
                      <input
                        {...register('name')}
                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none font-bold"
                        placeholder="Ex: Minha Empresa"
                      />
                      {errors.name && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Timezone</label>
                      <select
                        {...register('timezone')}
                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none font-bold appearance-none"
                      >
                        <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
                        <option value="UTC">Universal Time (UTC)</option>
                        <option value="America/New_York">New York (UTC-5)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Idioma</label>
                      <select
                        {...register('language')}
                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none font-bold appearance-none"
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en">English (US)</option>
                        <option value="es">Español</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">URL do Logo</label>
                      <input
                        {...register('logo_url')}
                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none font-bold"
                        placeholder="https://exemplo.com/logo.png"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: WhatsApp */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white uppercase tracking-widest text-xs opacity-50">Conexões Ativas</h3>
                    <button
                      type="button"
                      onClick={handleNewConnection}
                      disabled={isConnecting}
                      className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                    >
                      {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Nova Conexão
                    </button>
                  </div>

                  {qrCode && (
                    <div className="bg-white p-6 rounded-3xl inline-block mx-auto mb-8 shadow-2xl border-4 border-primary">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 mx-auto" />
                      <p className="text-zinc-800 text-[10px] font-black text-center mt-4">ESCANEIE AGORA</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {connections.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl">
                        <Smartphone size={48} className="text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-500 font-bold">Nenhuma conexão ativa encontrada.</p>
                      </div>
                    ) : (
                      connections.map((conn) => (
                        <div key={conn.id} className="bg-zinc-950/50 border border-white/5 p-6 rounded-2xl flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                              <Smartphone size={24} className={conn.status === 'connected' ? 'text-emerald-500' : 'text-zinc-500'} />
                            </div>
                            <div>
                              <p className="text-white font-black">{conn.instance_name}</p>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{conn.phone_number || 'Sem número'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${conn.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {conn.status}
                            </span>

                            {conn.status === 'connected' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const toastId = toast.loading("Sincronizando contatos...");
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();

                                    // 10s Timeout
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                                    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-contacts-on-connect`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${session?.access_token}`
                                      },
                                      body: JSON.stringify({
                                        instance_id: conn.instance_name,
                                        organization_id: orgId
                                      }),
                                      signal: controller.signal
                                    });

                                    clearTimeout(timeoutId);

                                    if (!res.ok) throw new Error("Falha na sincronização");
                                    const data = await res.json();
                                    toast.dismiss(toastId);
                                    toast.success(`${data.imported} contatos sincronizados!`);
                                  } catch (e: any) {
                                    toast.dismiss(toastId);
                                    if (e.name === 'AbortError') {
                                      toast.error("A sincronização demorou muito. O processo continua em segundo plano.");
                                    } else {
                                      toast.error("Erro ao iniciar sincronização.");
                                    }
                                  }
                                }}
                                className="p-2 text-zinc-700 hover:text-primary transition-colors"
                                title="Sincronizar Contatos"
                              >
                                <RefreshCw size={20} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDisconnect(conn.instance_name)}
                              className="p-2 text-zinc-700 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Integrações */}
              {activeTab === 'integrations' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest text-xs opacity-50">Plugins Internos</h3>

                  {/* Chatwoot */}
                  <div className="bg-zinc-950/50 border border-white/5 p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="text-blue-400" size={24} />
                        <h4 className="text-lg font-black text-white">Chatwoot (Human-First)</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Desligado</span>
                        <button
                          type="button"
                          onClick={() => setValue('chatwoot_enabled', !watch('chatwoot_enabled'))}
                          className={`w-12 h-6 rounded-full transition-all relative ${watch('chatwoot_enabled') ? 'bg-primary' : 'bg-zinc-800'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${watch('chatwoot_enabled') ? 'left-7' : 'left-1'}`} />
                        </button>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Ligado</span>
                      </div>
                    </div>

                    {watch('chatwoot_enabled') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in duration-300">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">URL Base API</label>
                          <input
                            {...register('chatwoot_url')}
                            className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none font-bold"
                            placeholder="https://chatwoot.suaempresa.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Access Token</label>
                          <input
                            type="password"
                            {...register('chatwoot_api_key')}
                            className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none font-bold"
                            placeholder="Ex: abc123def..."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI / OpenAI */}
                  <div className="bg-zinc-950/50 border border-white/5 p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BrainCircuit className="text-primary" size={24} />
                        <h4 className="text-lg font-black text-white">Inteligência Artificial (OpenAI)</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setValue('ai_active', !watch('ai_active'))}
                          className={`w-12 h-6 rounded-full transition-all relative ${watch('ai_active') ? 'bg-primary' : 'bg-zinc-800'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${watch('ai_active') ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>

                    {watch('ai_active') && (
                      <div className="grid grid-cols-1 gap-4 animate-in zoom-in duration-300">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">OpenAI API Key (GPT-4o)</label>
                          <input
                            type="password"
                            {...register('openai_api_key')}
                            className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none font-bold"
                            placeholder="sk-..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Horário */}
              {activeTab === 'hours' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest text-xs opacity-50">Service Level Agreement (SLA)</h3>

                  <div className="space-y-4">
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, i) => (
                      <div key={day} className="flex items-center justify-between bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4 w-1/3">
                          <input type="checkbox" defaultChecked={i < 5} className="w-5 h-5 accent-primary bg-zinc-800 border-none rounded" />
                          <span className="text-sm font-black text-white">{day}</span>
                        </div>
                        <div className="flex items-center gap-4 flex-1">
                          <input type="time" defaultValue="09:00" className="bg-zinc-900 text-white rounded-lg px-3 py-2 text-xs font-bold outline-none flex-1 border border-white/5" />
                          <span className="text-zinc-700 font-black">ATÉ</span>
                          <input type="time" defaultValue="18:00" className="bg-zinc-900 text-white rounded-lg px-3 py-2 text-xs font-bold outline-none flex-1 border border-white/5" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                    <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest italic">Preview do Atendimento:</p>
                    <p className="text-white text-sm font-bold mt-1">Segunda a Sexta das 09h às 18h. Fora destes horários, o sistema apenas captura o lead.</p>
                  </div>
                </div>
              )}

              {/* Tab: Notificações */}
              {activeTab === 'notifications' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest text-xs opacity-50">Alertas e E-mails</h3>

                  <div className="space-y-6">
                    <div
                      onClick={() => setValue('notification_settings.email_new_message', !watch('notification_settings.email_new_message'))}
                      className={`flex items-center justify-between p-6 rounded-3xl border cursor-pointer transition-all ${watch('notification_settings.email_new_message') ? 'bg-primary/10 border-primary' : 'bg-zinc-950/50 border-white/5'}`}
                    >
                      <div className="flex items-center gap-4">
                        <Mail className={watch('notification_settings.email_new_message') ? 'text-primary' : 'text-zinc-600'} />
                        <div>
                          <p className="text-sm font-black text-white">Nova Mensagem</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Avisar por e-mail quando chegar novo lead.</p>
                        </div>
                      </div>
                      {watch('notification_settings.email_new_message') && <CheckCircle2 className="text-primary" />}
                    </div>

                    <div
                      onClick={() => setValue('notification_settings.email_critical_error', !watch('notification_settings.email_critical_error'))}
                      className={`flex items-center justify-between p-6 rounded-3xl border cursor-pointer transition-all ${watch('notification_settings.email_critical_error') ? 'bg-red-500/10 border-red-500' : 'bg-zinc-950/50 border-white/5'}`}
                    >
                      <div className="flex items-center gap-4">
                        <AlertCircle className={watch('notification_settings.email_critical_error') ? 'text-red-500' : 'text-zinc-600'} />
                        <div>
                          <p className="text-sm font-black text-white">Erros Críticos</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Alertar se a API ou Webhook cair.</p>
                        </div>
                      </div>
                      {watch('notification_settings.email_critical_error') && <CheckCircle2 className="text-red-500" />}
                    </div>

                    <div className="space-y-2 mt-8">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">E-mail de Destino</label>
                      <input
                        {...register('notification_settings.destination_email')}
                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-white font-bold"
                        placeholder="admin@suaempresa.com"
                      />
                      {errors.notification_settings?.destination_email && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.notification_settings.destination_email.message}</p>}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Save Button Floating/Bottom */}
            <div className="flex justify-between items-center bg-zinc-900 border border-white/5 p-6 rounded-3xl shadow-2xl sticky bottom-4 z-10 animate-in slide-in-from-bottom-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alterações Pendentes</p>
                <p className="text-white text-xs font-bold">{isDirty ? "Você possui mudanças não salvas." : "Sistema atualizado."}</p>
              </div>
              <button
                type="submit"
                disabled={loading || !isDirty}
                className={`
                   flex items-center gap-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-primary/20
                   ${isDirty ? 'bg-primary text-zinc-950 hover:scale-105 active:scale-95' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'}
                 `}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function BrainCircuit(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.248 c.034 2.336 2.112 4.125 4.542 4.102a4.462 4.462 0 0 0 2.213-.585 3 3 0 0 0 4.444-4.14 4 4 0 0 0 2.526-5.77 4 4 0 0 0-.52-8.248c-.034-2.336-2.112-4.125-4.542-4.102a4.462 4.462 0 0 0-2.213.585Z" />
      <path d="M10 15a2 2 0 1 0-4 0 2 2 0 0 0 4 0Q12 15 12 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
    </svg>
  );
}
