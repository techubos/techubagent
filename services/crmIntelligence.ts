import { Contact, Message } from "../types";

/**
 * MOTOR DE INTELIGÊNCIA DO CRM
 * Em produção, isso rodaria no backend (Node.js) toda vez que uma mensagem chegasse.
 * Aqui, simulamos a análise no frontend ao selecionar o contato.
 */

interface CRMAnalysis {
    priority: 'high' | 'medium' | 'low';
    score: number;
    sentiment: 'positive' | 'neutral' | 'angry';
    suggestion: string;
    alert?: string;
}

export const analyzeContactContext = (contact: Contact, messages: Message[]): CRMAnalysis => {
    // 1. Análise Básica (Sem mensagens)
    if (!messages || messages.length === 0) {
        return {
            priority: 'low',
            score: 10,
            sentiment: 'neutral',
            suggestion: 'Iniciar primeiro contato (Quebra-gelo).'
        };
    }

    const lastMsg = messages[messages.length - 1];
    const lastMsgIsUser = lastMsg.role === 'user';
    const hoursSinceLastMsg = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (1000 * 60 * 60);

    let priority: 'high' | 'medium' | 'low' = 'low';
    let score = 30;
    let sentiment: 'positive' | 'neutral' | 'angry' = 'neutral';
    let suggestion = 'Aguardar interação.';
    let alert = undefined;

    // 2. Análise de Sentimento (Heurística simples de palavras-chave)
    const allText = messages.map(m => m.content.toLowerCase()).join(' ');
    if (allText.includes('erro') || allText.includes('não funciona') || allText.includes('absurdo') || allText.includes('cancelar')) {
        sentiment = 'angry';
        priority = 'high';
        alert = 'Risco de Churn detectado!';
    } else if (allText.includes('comprar') || allText.includes('preço') || allText.includes('agendar') || allText.includes('fechar')) {
        sentiment = 'positive';
        score += 40;
    }

    // 3. Cálculo de Prioridade e Score
    if (contact.status === 'talking' || contact.status === 'scheduled') score += 20;
    if (contact.status === 'client') score += 10;

    if (sentiment === 'angry') {
        suggestion = 'Acionar protocolo de contenção (Playbook Cliente Irritado).';
    } else if (lastMsgIsUser) {
        // Cliente falou por último
        priority = 'high';
        score += 10;
        
        if (lastMsg.content.includes('?')) {
            suggestion = 'Responder dúvida do cliente.';
        } else {
            suggestion = 'Validar informação e continuar fluxo.';
        }
    } else {
        // Agente falou por último
        if (hoursSinceLastMsg > 48) {
            priority = 'medium';
            suggestion = 'Fazer Follow-up (Cliente inativo há 2 dias).';
            alert = 'Gargalo: Cliente parado no funil.';
        } else if (hoursSinceLastMsg > 24) {
            suggestion = 'Aguardar mais um pouco.';
        } else {
            suggestion = 'Aguardar resposta.';
        }
    }

    // Ajuste final de prioridade baseada em score
    if (score > 80) priority = 'high';

    return {
        priority,
        score: Math.min(score, 100),
        sentiment,
        suggestion,
        alert
    };
};