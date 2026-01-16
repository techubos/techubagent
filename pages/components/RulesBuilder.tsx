import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/index';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react';

export function RulesBuilder({ organizationId }: { organizationId: string }) {
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        trigger_keywords: '',
        condition_type: 'always',
        action_type: 'respond',
        action_value: '',
        priority: 0
    });

    useEffect(() => {
        loadRules();
    }, [organizationId]);

    const loadRules = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('ai_rules')
            .select('*')
            .eq('organization_id', organizationId)
            .order('priority', { ascending: false });
        setRules(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        const keywordsArray = formData.trigger_keywords.split(',').map(s => s.trim()).filter(Boolean);

        const payload = {
            organization_id: organizationId,
            name: formData.name,
            trigger_keywords: keywordsArray,
            condition_type: formData.condition_type,
            action_type: formData.action_type,
            action_value: formData.action_value,
            priority: formData.priority
        };

        let error;
        if (editingRule) {
            const { error: e } = await supabase.from('ai_rules').update(payload).eq('id', editingRule.id);
            error = e;
        } else {
            const { error: e } = await supabase.from('ai_rules').insert(payload);
            error = e;
        }

        if (error) toast.error("Erro ao salvar regra");
        else {
            toast.success("Regra salva!");
            setModalOpen(false);
            loadRules();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza?")) return;
        await supabase.from('ai_rules').delete().eq('id', id);
        loadRules();
    };

    const openEdit = (rule: any) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            trigger_keywords: (rule.trigger_keywords || []).join(', '),
            condition_type: rule.condition_type,
            action_type: rule.action_type,
            action_value: rule.action_value || '',
            priority: rule.priority
        });
        setModalOpen(true);
    };

    const openNew = () => {
        setEditingRule(null);
        setFormData({ name: '', trigger_keywords: '', condition_type: 'always', action_type: 'respond', action_value: '', priority: 0 });
        setModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Regras de Negócio</h2>
                <Button onClick={openNew}><Plus size={16} className="mr-2" /> Nova Regra</Button>
            </div>

            {loading ? <div className="text-center text-zinc-500">Carregando...</div> : (
                <div className="grid gap-4">
                    {rules.length === 0 && <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500">Nenhuma regra configurada.</div>}

                    {rules.map(rule => (
                        <div key={rule.id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg flex justify-between items-center group">
                            <div>
                                <div className="font-bold text-white text-lg">{rule.name}</div>
                                <div className="text-sm text-zinc-400">
                                    <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs mr-2">P:{rule.priority}</span>
                                    Gatilho: {(rule.trigger_keywords || []).length > 0 ? (rule.trigger_keywords || []).join(', ') : 'Sempre'}
                                </div>
                                <div className="text-sm text-primary mt-1 capitalize">
                                    {rule.action_type === 'respond' ? 'Responder IA' : rule.action_type === 'transfer_human' ? 'Transferir Humano' : rule.action_type}
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}><Edit2 size={16} /></Button>
                                <Button size="icon" variant="destructive" onClick={() => handleDelete(rule.id)}><Trash2 size={16} /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra'}</DialogTitle></DialogHeader>

                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Nome da Regra</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-zinc-800 text-white" />
                        </div>
                        <div>
                            <Label>Palavras-Chave (Separadas por vírgula)</Label>
                            <Input value={formData.trigger_keywords} onChange={e => setFormData({ ...formData, trigger_keywords: e.target.value })} placeholder="preço, quanto custa, valor" className="bg-zinc-800 text-white" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Prioridade (Maior vence)</Label>
                                <Input type="number" value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })} className="bg-zinc-800 text-white" />
                            </div>
                            <div>
                                <Label>Tipo de Ação</Label>
                                <Select value={formData.action_type} onValueChange={(v: any) => setFormData({ ...formData, action_type: v })}>
                                    <SelectTrigger className="bg-zinc-800 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="respond">Responder Mensagem</SelectItem>
                                        <SelectItem value="transfer_human">Transferir para Humano</SelectItem>
                                        <SelectItem value="execute_function">Executar Função</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Resposta / Valor da Ação</Label>
                            <Textarea value={formData.action_value} onChange={e => setFormData({ ...formData, action_value: e.target.value })} placeholder="Digite a resposta da IA ou observação para transferência..." className="bg-zinc-800 text-white min-h-[100px]" />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
