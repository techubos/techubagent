import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/index';
// Using Select from index might need adjustment if I made a custom one, checking previous context... 
// I created a simple mockup one in ui/index.tsx. It'll suffice.
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

export function PersonalityConfig({ organizationId, agentId }: { organizationId: string, agentId: string }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        personality: 'friendly',
        custom_instructions: '',
        confidence_threshold: 0.7
    });

    useEffect(() => {
        loadSettings();
    }, [agentId]);

    const loadSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ai_agents')
            .select('personality, custom_instructions, confidence_threshold')
            .eq('id', agentId)
            .single();

        if (error) {
            toast.error("Erro ao carregar configurações");
        } else if (data) {
            setFormData({
                personality: data.personality || 'friendly',
                custom_instructions: data.custom_instructions || '',
                confidence_threshold: data.confidence_threshold || 0.7
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
            toast.success("Personalidade atualizada!");
        }
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-white" /></div>;

    return (
        <div className="space-y-6 max-w-2xl bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-white">Tom de Voz (Personalidade)</Label>
                    <Select
                        value={formData.personality}
                        onValueChange={(v: string) => setFormData(prev => ({ ...prev, personality: v }))}
                    >
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="friendly">Amigável / Casual</SelectItem>
                            <SelectItem value="professional">Formal / Profissional</SelectItem>
                            <SelectItem value="technical">Técnico / Especialista</SelectItem>
                            <SelectItem value="sales">Vendedor / Persuasivo</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-zinc-500">Define como a IA constrói as frases e usa emojis.</p>
                </div>

                <div className="space-y-2">
                    <Label className="text-white">Instruções Personalizadas (Prompt do Sistema)</Label>
                    <Textarea
                        value={formData.custom_instructions}
                        onChange={(e: any) => setFormData(prev => ({ ...prev, custom_instructions: e.target.value }))}
                        className="bg-zinc-950 border-zinc-800 min-h-[200px] text-white"
                        placeholder="Ex: Você é um especialista em energia solar. Nunca fale preços sem antes qualificar o cliente..."
                    />
                    <p className="text-xs text-zinc-500">Regras gerais que a IA deve seguir em todas as conversas.</p>
                </div>

                <div className="space-y-2">
                    <Label className="text-white">Confiança Mínima ({formData.confidence_threshold})</Label>
                    <Input
                        type="range"
                        min="0" max="1" step="0.1"
                        value={formData.confidence_threshold}
                        onChange={(e: any) => setFormData(prev => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))}
                        className="bg-zinc-950 border-zinc-800"
                    />
                    <p className="text-xs text-zinc-500">
                        Se a IA tiver menos de {Math.round(formData.confidence_threshold * 100)}% de certeza, ela passará para um humano.
                    </p>
                </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Personalidade
            </Button>
        </div>
    );
}
