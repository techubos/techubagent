import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import { generateEmbedding } from '../services/geminiService';
import { KnowledgeSidebar } from '../components/knowledge/KnowledgeSidebar';
import { DocumentList } from '../components/knowledge/DocumentList';
import { DocumentEditor } from '../components/knowledge/DocumentEditor';

interface KnowledgeBaseProps {
  initialData?: any;
  onClearData?: () => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ initialData, onClearData }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all' && selectedCategory !== 'recent' && selectedCategory !== 'archived') {
        query = query.eq('category', selectedCategory);
      }

      if (selectedCategory === 'archived') {
        query = query.eq('is_active', false);
      } else {
        // By default show active docs unless filter is explicit
        // query = query.eq('is_active', true); 
        // Showing all for general list might be better, let's filter in UI if needed or refined here
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar documentos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDocument = async (doc: any) => {
    setIsSaving(true);
    try {
      const embedding = await generateEmbedding(doc.content);

      const docData = {
        title: doc.title,
        content: doc.content,
        category: doc.category,
        priority: doc.priority,
        version: (doc.version || 0) + 1,
        is_active: doc.is_active,
        expires_at: doc.expires_at || null,
        tags: doc.tags,
        embedding // Always update embedding on save
      };

      let error;
      if (doc.id) {
        // Update existing (or create new version logic could go here, for now simple update)
        // If we want comprehensive version control we should INSERT new row and mark old as replaced
        // reusing logic from previous VersionControl
        const { error: updateError } = await supabase
          .from('documents')
          .update(docData)
          .eq('id', doc.id);
        error = updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('documents')
          .insert({ ...docData, version: 1 });
        error = insertError;
      }

      if (error) throw error;

      toast.success("Documento salvo com sucesso!");
      setIsEditing(false);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Tem certeza? Isso irá arquivar o documento.")) return;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      toast.success("Documento excluído.");
      setSelectedDoc(null);
      setIsEditing(false);
      fetchDocuments();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  // Stats for sidebar
  const stats = {
    total: documents.length,
    active: documents.filter(d => d.is_active).length,
    archived: documents.filter(d => !d.is_active).length
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      <KnowledgeSidebar
        activeCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        stats={stats}
      />

      <DocumentList
        documents={documents}
        selectedDocId={selectedDoc?.id}
        onSelectDoc={(doc) => {
          setSelectedDoc(doc);
          setIsEditing(true);
        }}
        onNewDoc={() => {
          setSelectedDoc(null);
          setIsEditing(true);
        }}
        isLoading={loading}
      />

      <div className="flex-1 bg-zinc-950 relative">
        {isEditing ? (
          <DocumentEditor
            initialDoc={selectedDoc}
            onSave={handleSaveDocument}
            onDelete={handleDeleteDocument}
            onCancel={() => {
              setIsEditing(false);
              setSelectedDoc(null);
            }}
            isSaving={isSaving}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-8 text-center animate-in fade-in">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
              <img src="/logo.png" className="w-8 h-8 opacity-50 grayscale" alt="" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <h3 className="text-xl font-bold text-zinc-300 mb-2">Base de Conhecimento Profissional</h3>
            <p className="max-w-md text-sm">Selecione um documento na lista para editar ou criar novos conteúdos para treinar sua IA.</p>
          </div>
        )}
      </div>
    </div>
  );
};