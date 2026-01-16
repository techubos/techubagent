import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Button, Input, Label, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/index';
import { toast } from 'sonner';
import { Loader2, Save, Clock, MessageSquare, Zap } from 'lucide-react';

export function BehaviorConfig({ organizationId, agentId }: { organizationId: string, agentId: string }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        model: 'gpt-4o-mini',
        simulate_typing: true,
        typing_wpm: 60,
        split_messages: true,
        chunks_delay_ms: 500
    });

    useEffect(() => {
        loadSettings();
    }, [agentId]);

    const loadSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ai_agents')
            .select('model, simulate_typing, typing_wpm, split_messages, chunks_delay_ms')
            .eq('id', agentId)
            .single();

        if (error) {
            toast.error("Erro ao carregar comportamento");
        } else if (data) {
            setFormData({
                model: data.model || 'gpt-4o-mini',
                simulate_typing: data.simulate_typing ?? true,
                typing_wpm: data.typing_wpm || 60,
                split_messages: data.split_messages ?? true,
                chunks_delay_ms: data.chunks_delay_ms || 500
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('ai_agents')
            .update(formData)
            .eq('id', agentId);

        if (error) {
            toast.error("Erro ao salvar");
        } else {
            toast.success("Comportamento atualizado!");
        }
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-white" /></div>;

    return (
        <div className="space-y-6 max-w-2xl bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
            {/* AI Model */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-medium">
                    <Zap className="text-yellow-500" size={18} /> Modelo de Inteligência
                </div>
                <Select
                    value={formData.model}
                    onValueChange={(v: string) => setFormData(prev => ({ ...prev, model: v }))}
                >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido & Econômico) - Recomendado</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o (Mais Inteligente & Caro)</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Legado)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="h-px bg-zinc-800 my-4" />

            {/* Typing Simulation */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-white flex items-center gap-2">
                            <Clock className="text-blue-500" size={16} /> Simular Digitação
                        </Label>
                        <p className="text-xs text-zinc-500">Faz a IA parecer humana digitando antes de enviar.</p>
                    </div>
                    <Switch
                        checked={formData.simulate_typing}
                        onCheckedChange={(c: boolean) => setFormData(prev => ({ ...prev, simulate_typing: c }))}
                    />
                </div>

                {formData.simulate_typing && (
                    <div className="space-y-2 pl-6 border-l-2 border-zinc-800">
                        <Label className="text-zinc-300">Velocidade de Digitação (Palavras por Minuto)</Label>
                        <div className="flex items-center gap-4">
                            <Input
                                type="range"
                                min="30" max="150" step="5"
                                value={formData.typing_wpm}
                                onChange={(e: any) => setFormData(prev => ({ ...prev, typing_wpm: parseInt(e.target.value) }))}
                                className="bg-zinc-950 border-zinc-800 flex-1"
                            />
                            <span className="text-white font-mono w-12 text-center">{formData.typing_wpm}</span>
                        </div>
                        <p className="text-xs text-zinc-500">Média humana: 60 WPM. Muito rápido pode parecer robô.</p>
                    </div>
                )}
            </div>

            <div className="h-px bg-zinc-800 my-4" />

            {/* Split Messages */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-white flex items-center gap-2">
                            <MessageSquare className="text-green-500" size={16} /> Quebrar Mensagens Longas
                        </Label>
                        <p className="text-xs text-zinc-500">Divide textos grandes em vários balões menores.</p>
                    </div>
                    <Switch
                        checked={formData.split_messages}
                        onCheckedChange={(c: boolean) => setFormData(prev => ({ ...prev, split_messages: c }))}
                    />
                </div>

                {formData.split_messages && (
                    <div className="space-y-2 pl-6 border-l-2 border-zinc-800">
                        <Label className="text-zinc-300">Delay entre mensagens (ms)</Label>
                        <div className="flex items-center gap-4">
                            <Input
                                type="number"
                                value={formData.chunks_delay_ms}
                                onChange={(e: any) => setFormData(prev => ({ ...prev, chunks_delay_ms: parseInt(e.target.value) }))}
                                className="bg-zinc-950 border-zinc-800 w-32 text-white"
                            />
                            <span className="text-zinc-500 text-sm">milissegundos</span>
                        </div>
                    </div>
                )}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full mt-6 bg-primary hover:bg-primary/90">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Comportamento
            </Button>
        </div>
    );
}
