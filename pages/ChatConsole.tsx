import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCcw, Smartphone, Bot, User, Database, Loader2, BrainCircuit, Mic, Play, Pause, FileAudio, Users, History } from 'lucide-react';
import { AgentSettings, Message, UserMemory, Contact } from '../types';
import { createChatSession, sendMessageToGemini, generateEmbedding, sendMessageToAI } from '../services/geminiService';
import { analyzeAndExtractMemory, buildContextualPrompt } from '../services/memoryService';
import { shouldReplyWithAudio, analyzeContent, playBrowserTTS } from '../services/audioLogic';
import { supabase } from '../services/supabaseClient';

interface ChatConsoleProps {
  settings: AgentSettings;
}

// Componente Visual de Player de Áudio (Fake)
const AudioBubble = ({ duration, playing, onPlay }: { duration: string, playing: boolean, onPlay: () => void }) => (
  <div className="flex items-center gap-3 min-w-[200px]">
    <button
      onClick={onPlay}
      className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
    >
      {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
    </button>
    <div className="flex-1 flex flex-col justify-center gap-1">
      <div className="h-1 bg-gray-300 rounded-full w-full overflow-hidden">
        <div className={`h-full bg-blue-500 ${playing ? 'animate-[width_2s_linear_infinite]' : 'w-1/3'}`}></div>
      </div>
    </div>
    <span className="text-[10px] text-gray-500 font-mono">{duration}</span>
    <div className="absolute bottom-[-18px] left-2 flex items-center gap-1">
      <Mic size={10} className="text-gray-400" />
      <span className="text-[10px] text-gray-400">Áudio Transcrito</span>
    </div>
  </div>
);

export const ChatConsole: React.FC<ChatConsoleProps> = ({ settings }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [retrievedContext, setRetrievedContext] = useState<string | null>(null);

  // Real Data Simulation State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  // Estado de Áudio
  const [inputType, setInputType] = useState<'text' | 'audio'>('text');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  const [userMemory, setUserMemory] = useState<UserMemory>({
    painPoints: [],
    preferences: [],
    operationalStatus: 'lead'
  });
  const [isMemoryUpdating, setIsMemoryUpdating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startNewSession();
    fetchContactsForSimulation();
  }, [settings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchContactsForSimulation = async () => {
    const { data } = await supabase.from('contacts').select('id, name, status, notes').limit(50);
    if (data) setContacts(data as any);
  };

  const loadContactSimulation = async (contactId: string) => {
    setSelectedContactId(contactId);
    if (!contactId) {
      startNewSession(); // Reset if cleared
      return;
    }

    setIsLoading(true);
    try {
      // 1. Get Contact Details
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      // 2. Hydrate Memory
      setUserMemory({
        userName: contact.name,
        operationalStatus: contact.status as any,
        painPoints: contact.notes ? [contact.notes] : [], // Simplificação: Notas viram dores iniciais
        preferences: ['Simulação Real'],
        userRole: 'Cliente CRM'
      });

      // 3. Load Recent History (Real Messages)
      const { data: realMsgs } = await supabase
        .from('messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true })
        .limit(10);

      const history: Message[] = (realMsgs || []).map((m: any) => ({
        id: m.id,
        role: m.role === 'assistant' ? 'model' : m.role,
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        message_type: m.msg_type || 'text'
      }));

      setMessages([
        {
          id: 'system-start',
          role: 'system',
          content: `Simulação carregada para: ${contact.name}. Histórico importado do banco.`,
          timestamp: Date.now(),
          message_type: 'text'
        },
        ...history
      ]);

      const session = createChatSession(settings);
      setChatSession(session);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = () => {
    try {
      const session = createChatSession(settings);
      setChatSession(session);
      setMessages([
        {
          id: 'system-1',
          role: 'system',
          content: 'Simulação iniciada (Modo Sandbox). Selecione um contato acima para usar dados reais.',
          timestamp: Date.now(),
          message_type: 'text'
        }
      ]);
      setRetrievedContext(null);
      setUserMemory({ painPoints: [], preferences: [], operationalStatus: 'lead' });
      setSelectedContactId('');
    } catch (e) {
      console.error(e);
    }
  };

  const searchKnowledgeBase = async (query: string) => {
    try {
      const embedding = await generateEmbedding(query);
      if (!embedding) return null;

      const { data: documents, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 3
      });

      if (error || !documents || documents.length === 0) return null;
      return documents.map((d: any) => d.content).join('\n\n');
    } catch (err) {
      console.error("Erro no RAG:", err);
      return null;
    }
  };

  const handleSend = async (forcedType: 'text' | 'audio' = 'text') => {
    if (!input.trim() || !chatSession) return;

    const userText = input;
    const currentMsgType = forcedType;

    setInput('');
    setIsLoading(true);
    setRetrievedContext(null);
    setIsMemoryUpdating(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      message_type: currentMsgType
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const [context, updatedMemory] = await Promise.all([
        searchKnowledgeBase(userText),
        analyzeAndExtractMemory(userMemory, userText)
      ]);

      setRetrievedContext(context);
      setUserMemory(updatedMemory);
      setIsMemoryUpdating(false);

      const historyContext = messages.length > 1 && selectedContactId
        ? `[HISTÓRICO RECENTE]: O usuário já conversou ${messages.length} vezes. Continue a conversa naturalmente.`
        : '';

      const fullContextualPrompt = buildContextualPrompt(
        "Responda a mensagem do usuário.",
        updatedMemory,
        context
      );

      const promptToModel = `
      ${fullContextualPrompt}
      ${historyContext}
      
      [CONTEXTO DE MÍDIA]
      O usuário enviou uma mensagem do tipo: ${currentMsgType.toUpperCase()}.
      ${currentMsgType === 'audio' ? 'O texto abaixo é a TRANSCRIÇÃO do áudio dele.' : ''}
      
      [MENSAGEM DO USUÁRIO]: ${userText}
      `;

      // UNIVERSAL SENDER (Supports Gemini, OpenAI, Claude, Groq, GLM)
      // We pass 'messages' (raw history) so the service can format it for the specific provider
      const responseText = await sendMessageToAI(settings, promptToModel, messages);

      const contentAnalysis = analyzeContent(responseText);
      const useAudioResponse = shouldReplyWithAudio({
        userMsgType: currentMsgType,
        responseText: responseText,
        containsLinks: contentAnalysis.hasLinks,
        containsCode: contentAnalysis.hasCode
      });

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
        message_type: useAudioResponse ? 'audio' : 'text'
      };

      setMessages(prev => [...prev, botMsg]);

      if (useAudioResponse) {
        playBrowserTTS(responseText);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsMemoryUpdating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend('text');
    }
  };

  const toggleAudioPlay = (msgId: string, text: string) => {
    if (currentlyPlayingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlyPlayingId(null);
    } else {
      setCurrentlyPlayingId(msgId);
      playBrowserTTS(text);
      setTimeout(() => {
        if (currentlyPlayingId === msgId) setCurrentlyPlayingId(null);
      }, 3000 + (text.length * 50));
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">

      {/* 1. Simulator Container */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Header */}
        <div className="bg-[#008069] p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{settings.name}</h3>
              <p className="text-xs opacity-80 flex items-center gap-1">
                {isMemoryUpdating ? <Loader2 className="animate-spin" size={10} /> : <span className="w-2 h-2 bg-green-400 rounded-full"></span>}
                {isMemoryUpdating ? 'Memorizando...' : 'Online'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center bg-white/10 rounded-lg px-2 py-1">
              <Users size={14} className="mr-2 opacity-70" />
              <select
                value={selectedContactId}
                onChange={(e) => loadContactSimulation(e.target.value)}
                className="bg-transparent border-none text-xs focus:ring-0 text-white [&>option]:text-black cursor-pointer w-40"
              >
                <option value="">-- Usuário Anônimo --</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button onClick={startNewSession} title="Resetar Conversa" className="p-2 hover:bg-white/10 rounded-full">
              <RefreshCcw size={18} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] space-y-3 relative">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a4a4a 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

          {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${msg.role === 'system' ? 'justify-center' : ''}`}>
              {msg.role === 'system' ? (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                  {msg.content.includes('histórico') && <History size={10} />}
                  {msg.content}
                </span>
              ) : (
                <div className={`max-w-[80%] rounded-lg p-3 shadow-sm relative text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                  }`}>

                  {msg.message_type === 'audio' ? (
                    <div className="flex flex-col gap-2">
                      <AudioBubble
                        duration={msg.content.length < 50 ? "0:05" : "0:14"}
                        playing={currentlyPlayingId === msg.id}
                        onPlay={() => toggleAudioPlay(msg.id, msg.content)}
                      />
                      <div className="pt-2 border-t border-gray-200/50 mt-1">
                        <p className="text-xs italic text-gray-500">"{msg.content}"</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {msg.content}
                      <span className="text-[10px] text-gray-400 block text-right mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}

                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#f0f2f5] p-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputType === 'audio' ? "Digite o que você falaria no áudio..." : "Digite sua mensagem..."}
            className={`flex-1 p-3 rounded-lg border-none focus:ring-0 focus:outline-none shadow-sm text-sm transition-colors ${inputType === 'audio'
              ? 'bg-red-50 text-red-900 placeholder-red-300'
              : 'bg-white text-gray-900 placeholder-gray-500' // CORRIGIDO: TEXTO ESCURO
              }`}
            disabled={isLoading}
          />

          {input.trim() ? (
            <button
              onClick={() => handleSend(inputType)}
              disabled={isLoading}
              className={`p-3 rounded-full shadow-sm flex items-center justify-center transition-all ${isLoading ? 'bg-gray-300' :
                inputType === 'audio' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#008069] text-white'
                }`}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          ) : (
            <button
              onClick={() => setInputType(prev => prev === 'text' ? 'audio' : 'text')}
              className={`p-3 rounded-full shadow-sm flex items-center justify-center transition-all ${inputType === 'audio' ? 'bg-red-100 text-red-600 ring-2 ring-red-400' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              title="Simular entrada de Áudio"
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col gap-4">

        {/* Memory Panel */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-1/2">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
            <h4 className="font-bold text-indigo-900 flex items-center gap-2">
              <BrainCircuit size={18} /> Memória Longa
            </h4>
            {isMemoryUpdating && <Loader2 className="animate-spin text-indigo-500" size={14} />}
          </div>
          <div className="p-4 overflow-y-auto text-sm space-y-4">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Quem é?</span>
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                <span className="font-medium text-gray-900">
                  {userMemory.userName || "Desconhecido"}
                  {userMemory.userCompany && <span className="text-gray-500 font-normal"> da {userMemory.userCompany}</span>}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Status Operacional</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${userMemory.operationalStatus === 'negotiation' ? 'bg-green-100 text-green-700' :
                userMemory.operationalStatus === 'support' ? 'bg-red-100 text-red-700' :
                  userMemory.operationalStatus === 'closed' ? 'bg-blue-100 text-blue-700' :
                    userMemory.operationalStatus === 'client' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                }`}>
                {userMemory.operationalStatus}
              </span>
            </div>

            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Dores / Notas</span>
              {userMemory.painPoints.length > 0 ? (
                <ul className="list-disc list-inside text-gray-600 text-xs">
                  {userMemory.painPoints.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              ) : <span className="text-xs text-gray-400 italic">Nenhuma nota ou dor identificada.</span>}
            </div>
          </div>
        </div>

        {/* RAG Panel */}
        <div className={`border rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden ${retrievedContext ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="p-4 border-b border-gray-200/50">
            <h4 className={`font-bold flex items-center gap-2 ${retrievedContext ? 'text-green-800' : 'text-gray-500'}`}>
              <Database size={18} />
              Contexto (RAG)
            </h4>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {retrievedContext ? (
              <div className="text-xs text-green-900 bg-white/50 p-2 rounded border border-green-100/50 whitespace-pre-line">
                {retrievedContext}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                <p className="text-xs italic">Nenhum documento da base foi necessário para esta resposta.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};