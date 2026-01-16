/**
 * LÓGICA DE DECISÃO DE MODALIDADE (AUDIO vs TEXTO)
 * 
 * Um humano não responde tudo com áudio. Existem regras sociais.
 * Este serviço decide qual a melhor forma de responder.
 */

interface DecisionInput {
    userMsgType: 'text' | 'audio';
    responseText: string;
    containsLinks: boolean;
    containsCode: boolean;
    userPreference?: string[]; // Ex: ["gosta de audio"]
}

export const shouldReplyWithAudio = (input: DecisionInput): boolean => {
    const charCount = input.responseText.length;

    // REGRA 1: Se tem link, código ou lista complexa -> SEMPRE TEXTO
    // Ninguém quer ouvir um URL sendo ditado.
    if (input.containsLinks || input.containsCode) {
        return false;
    }

    // REGRA 2: Se a resposta é muito longa (> 300 caracteres) -> TEXTO
    // Áudios de 2 minutos são chatos.
    if (charCount > 300) {
        return false;
    }

    // REGRA 3: Se o usuário mandou texto -> Preferência por TEXTO
    // (A menos que seja muito curto e coloquial, mas por segurança, texto)
    if (input.userMsgType === 'text') {
        return false;
    }

    // REGRA 4: Se o usuário mandou áudio -> Tente responder com ÁUDIO
    // Desde que obedeça as regras 1 e 2.
    if (input.userMsgType === 'audio') {
        return true;
    }

    return false;
};

// Função auxiliar para detectar links ou códigos no texto gerado pela IA
export const analyzeContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const codeRegex = /(```|`)/g; // Detecta blocos de código
    
    return {
        hasLinks: urlRegex.test(text),
        hasCode: codeRegex.test(text),
        length: text.length
    };
};

// Simulação de TTS (Text-to-Speech) usando API do navegador para demonstração
export const playBrowserTTS = (text: string) => {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR'; // Tenta português
        utterance.rate = 1.1; // Um pouco mais rápido para soar natural
        window.speechSynthesis.cancel(); // Para anteriores
        window.speechSynthesis.speak(utterance);
    }
};