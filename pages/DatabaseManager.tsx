import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Database, Table, Plus, Trash2, Save, X, Search, Edit2, Loader2, Check } from 'lucide-react';

// Tables configuration
const AVAILABLE_TABLES = [
    { id: 'contacts', label: 'Contatos', icon: Table },
    { id: 'internal_messages', label: 'Chat Interno', icon: Table },
    { id: 'help_articles', label: 'Central de Ajuda', icon: Table },
    { id: 'agents', label: 'Agentes IA', icon: Table },
    { id: 'scheduled_messages', label: 'Agendamentos', icon: Table },
    { id: 'organizations', label: 'Organizações', icon: Table },
];

export const DatabaseManager: React.FC = () => {
    const [selectedTable, setSelectedTable] = useState('contacts');
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, [selectedTable]);

    const fetchData = async () => {
        setLoading(true);
        // Clean state
        setEditingId(null);
        setIsCreating(false);
        setEditForm({});

        try {
            const { data: rows, error } = await supabase
                .from(selectedTable)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (rows && rows.length > 0) {
                // Infer columns from first row + some standards
                const keys = Object.keys(rows[0]).filter(k => k !== 'embedding'); // skip vector data
                setColumns(keys);
                setData(rows);
            } else {
                setData([]);
                // Fallback columns if empty? We might need to query schema, but for now empty state
                setColumns(['id', 'created_at']);
            }
        } catch (err: any) {
            console.error("Error fetching table:", err);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (row: any) => {
        setEditingId(row.id);
        setEditForm(row);
        setIsCreating(false);
    };

    const handleCreate = () => {
        setEditingId('new');
        setEditForm({});
        setIsCreating(true);
    };

    const handleSave = async () => {
        try {
            if (isCreating) {
                const { error } = await supabase.from(selectedTable).insert([editForm]);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from(selectedTable)
                    .update(editForm)
                    .eq('id', editingId);
                if (error) throw error;
            }

            // Success
            setEditingId(null);
            setIsCreating(false);
            setEditForm({});
            fetchData();
        } catch (error: any) {
            alert(`Erro ao salvar: ${error.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este registro?")) return;

        const { error } = await supabase.from(selectedTable).delete().eq('id', id);
        if (error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            fetchData();
        }
    };

    const filteredData = data.filter(row =>
        JSON.stringify(row).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
            {/* Sidebar with Tables */}
            <div className="w-64 border-r border-white/5 bg-zinc-900/30 flex flex-col hidden md:flex">
                <div className="p-6 border-b border-white/5">
                    <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                        <Database size={16} /> Banco de Dados
                    </h1>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {AVAILABLE_TABLES.map(table => (
                        <button
                            key={table.id}
                            onClick={() => setSelectedTable(table.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedTable === table.id
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <table.icon size={16} />
                            {table.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-950">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-white capitalize">{AVAILABLE_TABLES.find(t => t.id === selectedTable)?.label}</h2>
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] text-zinc-500 font-mono">
                            {data.length} registros
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Filtrar dados..."
                                className="bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-primary outline-none w-64"
                            />
                        </div>
                        <button
                            onClick={handleCreate}
                            className="bg-primary hover:bg-primaryHover text-black px-3 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Novo
                        </button>
                    </div>
                </div>

                {/* Data Grid */}
                <div className="flex-1 overflow-auto bg-black/20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <span className="text-xs uppercase tracking-widest font-bold">Carregando dados...</span>
                        </div>
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full divide-y divide-white/5">
                                <thead className="bg-zinc-900 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-zinc-500 uppercase tracking-wider w-20">Ações</th>
                                        {columns.map(col => (
                                            <th key={col} className="px-4 py-3 text-left text-[10px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-zinc-950/50">
                                    {isCreating && (
                                        <tr className="bg-primary/5 border-l-2 border-primary">
                                            <td className="px-4 py-3 whitespace-nowrap flex items-center gap-2">
                                                <button onClick={handleSave} className="text-primary hover:text-white" title="Salvar"><Save size={16} /></button>
                                                <button onClick={() => setIsCreating(false)} className="text-red-400 hover:text-white" title="Cancelar"><X size={16} /></button>
                                            </td>
                                            {columns.map(col => (
                                                <td key={col} className="px-4 py-3 whitespace-nowrap">
                                                    {col === 'id' || col === 'created_at' ? (
                                                        <span className="text-zinc-600 text-xs italic">Auto-gerado</span>
                                                    ) : (
                                                        <input
                                                            className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-primary outline-none"
                                                            value={editForm[col] || ''}
                                                            onChange={e => setEditForm({ ...editForm, [col]: e.target.value })}
                                                            placeholder={col}
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {filteredData.map((row) => {
                                        const isEditing = editingId === row.id;
                                        return (
                                            <tr key={row.id} className={`hover:bg-white/[0.02] transition-colors ${isEditing ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}>
                                                <td className="px-4 py-3 whitespace-nowrap flex items-center gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <button onClick={handleSave} className="text-emerald-400 hover:text-white"><Check size={16} /></button>
                                                            <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleEdit(row)} className="text-zinc-500 hover:text-primary"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDelete(row.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16} /></button>
                                                        </>
                                                    )}
                                                </td>
                                                {columns.map(col => (
                                                    <td key={col} className="px-4 py-3 whitespace-nowrap text-xs text-zinc-300 max-w-[200px] truncate">
                                                        {isEditing && col !== 'id' && col !== 'created_at' ? (
                                                            <input
                                                                className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-primary outline-none"
                                                                value={editForm[col] !== undefined ? editForm[col] : row[col]}
                                                                onChange={e => setEditForm({ ...editForm, [col]: e.target.value })}
                                                            />
                                                        ) : (
                                                            typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
