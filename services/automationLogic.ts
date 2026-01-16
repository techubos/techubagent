import { Contact } from "../types";

/**
 * LÓGICA DE EXECUÇÃO DE AUTOMAÇÃO
 * 
 * Regras rígidas para evitar comportamento de "Bot Chato" (Spam).
 */

export const isBusinessHours = (): boolean => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Domingo (0) ou Sábado (6) - Opcional: permitir sábado até 12h
    if (day === 0 || day === 6) return false;

    // Apenas entre 09:00 e 18:00
    return hour >= 9 && hour < 18;
};

export const shouldExecuteWorkflow = (contact: Contact, workflowType: string): { execute: boolean; reason?: string } => {
    
    // REGRA 1: Intervenção Humana
    // Se um humano assumiu o chat, cancele TODAS as automações imediatamente.
    if (contact.human_intervention) {
        return { execute: false, reason: "Intervenção humana ativa." };
    }

    // REGRA 2: Cliente Respondeu Recentemente
    // Se o cliente mandou mensagem nas últimas 24h, não mande follow-up de cobrança.
    if (contact.last_message_at) {
        const lastMsgTime = new Date(contact.last_message_at).getTime();
        const hoursSinceLastMsg = (Date.now() - lastMsgTime) / (1000 * 60 * 60);
        
        // Se for follow-up de venda e o cliente falou há pouco, PARE.
        if (workflowType === 'sales_followup' && hoursSinceLastMsg < 24) {
            return { execute: false, reason: "Cliente respondeu recentemente (Anti-Spam)." };
        }
    }

    // REGRA 3: Horário Comercial
    // Confirmação de agenda pode ir a qualquer hora? Talvez. Vendas não.
    if (workflowType === 'sales_followup' || workflowType === 'reactivation') {
        if (!isBusinessHours()) {
            return { execute: false, reason: "Fora do horário comercial." };
        }
    }

    // REGRA 4: Status Inválido
    // Não mandar follow-up de venda para quem já fechou.
    if (workflowType === 'sales_followup' && contact.status === 'client') {
        return { execute: false, reason: "Contato já é cliente." };
    }

    return { execute: true };
};

// Gera um pequeno atraso aleatório (Jitter) para não parecer robô mandando 1000 msgs às 09:00:00
export const getSafeSendTime = (baseDelayHours: number): Date => {
    const target = new Date();
    target.setHours(target.getHours() + baseDelayHours);
    
    // Adiciona jitter de 0 a 15 minutos
    const jitterMinutes = Math.floor(Math.random() * 15);
    target.setMinutes(target.getMinutes() + jitterMinutes);
    
    return target;
};