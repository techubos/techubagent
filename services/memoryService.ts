import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserMemory } from "../types";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
const ai = genAI; // Alias for compatibility with existing code structure if needed, or refactor below

// Prompt especializado apenas em extração de fatos, sem conversar.
const MEMORY_EXTRACTION_PROMPT = `
ROLE: MEMORY SCRIBE (Escriba de Memória)
OBJETIVO: Analisar a última mensagem do usuário e atualizar o JSON de memória.

REGRAS DE EXTRAÇÃO:
1. Extraia o NOME do usuário se mencionado.
2. Extraia a EMPRESA ou CARGO se mencionado.
3. Identifique DORES (problemas) e adicione à lista (sem duplicar).
4. Identifique PREFERÊNCIAS (ex: "prefiro email", "fale curto") e adicione.
5. Defina a INTENÇÃO ATUAL (ex: "comprar", "suporte", "dúvida técnica").
6. Sugira o STATUS OPERACIONAL:
   - "lead": Dúvidas gerais, conhecendo o produto.
   - "negotiation": Perguntou preço, prazo, agendamento.
   - "support": Relatou erro, problema ou dúvida de uso.
   - "closed": Já é cliente.

INPUT:
- Memória Atual (JSON)
- Última Mensagem do Usuário

OUTPUT:
- Apenas o JSON atualizado. Nada mais.
`;

export const analyzeAndExtractMemory = async (
  currentMemory: UserMemory,
  userMessage: string
): Promise<UserMemory> => {
  try {
    const model = ai.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0
      }
    });

    const prompt = `
    ${MEMORY_EXTRACTION_PROMPT}

    MEMÓRIA ATUAL:
    ${JSON.stringify(currentMemory)}

    MENSAGEM DO USUÁRIO:
    "${userMessage}"
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) return currentMemory;

    // Parse seguro
    const newMemory = JSON.parse(text) as UserMemory;

    // Merge de segurança para garantir que campos não sumam se a IA falhar
    return {
      ...currentMemory,
      ...newMemory,
      // Garante arrays
      painPoints: [...new Set([...(currentMemory.painPoints || []), ...(newMemory.painPoints || [])])],
      preferences: [...new Set([...(currentMemory.preferences || []), ...(newMemory.preferences || [])])],
    };

  } catch (error) {
    console.error("Erro ao processar memória:", error);
    return currentMemory; // Retorna o estado anterior em caso de erro
  }
};

export const buildContextualPrompt = (
  baseSystemPrompt: string,
  memory: UserMemory,
  ragContext: string | null
): string => {
  let contextBlock = "";

  // 1. Injeta Memória Longa (Perfil do Usuário)
  if (memory.userName || memory.userCompany || memory.painPoints.length > 0) {
    contextBlock += `
    [MEMÓRIA DE LONGO PRAZO / PERFIL DO CLIENTE]:
    - Nome: ${memory.userName || "Desconhecido"}
    - Empresa: ${memory.userCompany || "Não informada"}
    - Status: ${memory.operationalStatus || "Lead"}
    - Dores/Problemas: ${memory.painPoints.join(", ") || "Nenhum identificado"}
    - Preferências: ${memory.preferences.join(", ") || "Padrão"}
    `;
  }

  // 2. Injeta Memória RAG (Documentos)
  if (ragContext) {
    contextBlock += `
    [BASE DE CONHECIMENTO (FONTE DA VERDADE)]:
    ${ragContext}
    `;
  }

  // 3. Monta Prompt Final
  return `
  ${baseSystemPrompt}

  ============ INFORMAÇÕES CONTEXTUAIS ============
  ${contextBlock}
  =================================================
  
  Instrução: Use as informações acima para personalizar a resposta. 
  Se souber o nome, use. Se souber o problema, ofereça a solução específica.
  `;
};