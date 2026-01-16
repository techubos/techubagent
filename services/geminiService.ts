import { Message, AgentSettings, Contact } from "../types";
import { supabase } from "./supabaseClient";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// --- SECURE PROXY CALL HELPERS ---
const callAIProxy = async (action: 'chat' | 'embed', payload: Record<string, unknown>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Usuário não autenticado.");

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Proxy Error (${response.status})`);
  }
  return await response.json();
};

// --- CORE FUNCTIONS ---

export const createChatSession = (settings: AgentSettings) => {
  // Legacy support for ChatConsole
  return { virtual: true, settings };
};

export const sendMessageToGemini = async (chatSessionOrSettings: any, message: string, history?: Message[]): Promise<string> => {
  // Legacy wrapper redirecting to Universal Sender
  return "Legacy Function Deprecated";
};

// UNIVERSAL SENDER (Secure Proxy)
export const sendMessageToAI = async (settings: AgentSettings, userMessage: string, history: Message[]): Promise<string> => {
  try {
    const model = settings.model || 'gpt-4o-mini';
    const systemPrompt = settings.systemPrompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: userMessage }
    ];

    const data = await callAIProxy('chat', {
      model,
      messages,
      temperature: settings.temperature || 0.7
    });

    return data.choices[0].message.content;
  } catch (e: unknown) {
    console.error("AI Proxy Error:", e);
    return `Erro de IA (Seguro): ${e instanceof Error ? e.message : String(e)}`;
  }
};

// --- SYSTEM TASKS (Embeddings, CRM, Prompts) ---

// 1. EMBEDDINGS (Secure Proxy)
export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  try {
    const data = await callAIProxy('embed', { text });
    return data.data[0].embedding;
  } catch (error: unknown) {
    console.error("Erro ao gerar embedding via Proxy:", error);
    return null;
  }
};

// 2. CRM INTELLIGENCE (Drafts via Proxy)
export const generateCRMDraft = async (contact: Contact, history: Message[]): Promise<{ draft: string; action: string; reasoning: string }> => {
  const recentHistory = history.slice(-15).map(m => `${m.role === 'user' ? 'CLIENTE' : 'AGENTE'}: ${m.content}`).join('\n');

  const prompt = `
    ROLE: Senior Sales Manager & Copywriter.
    TAREFA: Analisar a conversa e criar a MELHOR resposta.
    
    DADOS DO CLIENTE:
    Nome: ${contact.name}
    Status: ${contact.status}
    Notas: ${contact.notes || "Nenhuma"}
  
    HISTÓRICO:
    ${recentHistory}
  
    OUTPUT JSON OBRIGATÓRIO (sem markdown, apenas json cru):
    {
      "draft": "Texto da mensagem sugerida",
      "action": "Ação sugerida",
      "reasoning": "Porquê"
    }
  `;

  try {
    const data = await callAIProxy('chat', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "Você é um assistente JSON especializado em vendas." },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const resultText = data.choices[0].message.content;
    return JSON.parse(resultText);

  } catch (error: unknown) {
    console.error("Erro ao gerar draft CRM via Proxy:", error);
    return {
      draft: `Erro de IA: ${error instanceof Error ? error.message : String(error)}`,
      action: "Erro",
      reasoning: "Falha na API segura."
    };
  }
};



// 4. CONTEXT SUMMARY (Active Sales Machine)
export const generateContextSummary = async (contact: Contact, history: Message[]): Promise<string> => {
  if (history.length === 0) return "Sem histórico de conversa.";

  const recentHistory = history.slice(-20).map(m => `${m.role === 'user' ? 'CLIENTE' : 'AGENTE'}: ${m.content}`).join('\n');

  const prompt = `
      ATUE COMO: Gerente de Conta Sênior.
      TAREFA: Resumir o estado atual deste lead em UMA frase curta e direta (máx 30 palavras).
      
      DADOS:
      Nome: ${contact.name}
      Histórico Recente:
      ${recentHistory}
      
      RETORNE APENAS O RESUMO.
      Exemplos:
      "Cliente interessado no plano Pro, mas achou caro. Precisa de desconto."
      "Lead frio, parou de responder após proposta. Tentar reativar."
      "Cliente satisfeito, pediu boleto para amanhã."
    `;

  try {
    const data = await callAIProxy('chat', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "Resumidor Sênior." },
        { role: 'user', content: prompt }
      ]
    });
    return data.choices[0].message.content || "Sem resumo disponível.";
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return "Não foi possível gerar o resumo inteligência."; // Changed to match original return type
  }
};

export const critiqueMessage = async (message: string): Promise<string> => {
  try {
    const data = await callAIProxy('chat', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "You are a world-class Copywriter for WhatsApp Sales. Critique this message in Portuguese (Brasil). Be direct and suggest a better version if necessary. Keep it under 50 words." },
        { role: 'user', content: `Message: "${message}"` }
      ]
    });
    return data.choices[0].message.content || "A mensagem parece boa.";
  } catch (error) {
    console.error('Error generating critique:', error);
    return "Erro ao analisar mensagem.";
  }
};

export const generateSystemPromptAI = async (
  businessName: string,
  niche: string,
  goal: string,
  tone: string,
  keyInfo: string
): Promise<string> => {
  const prompt = `
      ROLE: Expert Persona Designer.
      TASK: Create a defined professional System Prompt for an AI Agent.
      
      BUSINESS DETAILS:
      - Name: ${businessName}
      - Niche: ${niche}
      - Goal: ${goal}
      - Tone: ${tone}
      - Key Info: ${keyInfo}

      OUTPUT: Just the system prompt text, nothing else. Write in Portuguese.
    `;
  try {
    const data = await callAIProxy('chat', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "Prompt Engineer." },
        { role: 'user', content: prompt }
      ]
    });
    return data.choices[0].message.content || "Erro ao gerar prompt.";
  } catch (error) {
    console.error('Error generating system prompt:', error);
    return "Erro ao gerar prompt.";
  }
}

// 5. REAL-TIME WHISPER (Autocomplete)
export const getWhisperSuggestion = async (text: string, history: Message[]): Promise<string> => {
  const recentContext = history.slice(-5).map(m => `${m.role === 'user' ? 'CLIENTE' : 'AGENTE'}: ${m.content}`).join('\n');

  try {
    const data = await callAIProxy('chat', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "Complete the user's sentence naturally for a WhatsApp sales context (pt-BR). Return ONLY the completion suffix. If the text is complete, return nothing. Keep it short (max 5 words)." },
        { role: 'user', content: `Context:\n${recentContext}\n\nUser typing: "${text}"\nCompletion:` }
      ],
      temperature: 0.3,
      max_tokens: 20
    });

    const suggestion = data.choices[0].message.content?.trim();
    // Validate if suggestion actually makes sense to append
    if (!suggestion || suggestion.toLowerCase().includes('não') || suggestion.length < 2) return "";

    return text + " " + suggestion;
  } catch (error) {
    console.error('Whisper error:', error);
    return "";
  }
};