---
description: Padrões de "Blindagem" para o Processamento de Mídia (Áudio e Foto)
---

// turbo-all

Este workflow define a arquitetura "Gold Standard" para o `webhook-processor` do TecHub Agent. NUNCA remova estas proteções ao fazer modificações.

### 🛡️ 1. Proteção de Injeção de Imagem (Vision)
Para garantir que a IA "veja" e não seja preguiçosa:
- **Injeção Direta**: Use sempre Base64 Data URL no payload da OpenAI. Não dependa de URLs de storage apenas.
- **Detalhamento**: Use sempre `detail: "high"` no objeto `image_url`.
- **Escalação de Modelo**: Em mensagens de imagem, use obrigatoriamente o modelo `gpt-4o` (Full). Use `gpt-4o-mini` apenas como fallback ou para texto puro.

### 🛡️ 2. Resiliência de API (Retrias)
- **fetchWithRetry**: Toda chamada externa (Evolution API, OpenAI, Supabase Edge Functions) deve usar o helper `fetchWithRetry`.
- **Estratégia**: Mínimo de 3 tentativas com backoff exponencial.

### 🛡️ 3. Processamento de Áudio (Whisper)
- **Formato**: Enviar sempre como `audio/ogg` com extensão `.oga`.
- **MIME Type**: Garantir que o FormData tenha o tipo correto para evitar erros de "Invalid File" na OpenAI.

### 🛡️ 4. Higiene de Logs
- **Sanitização**: Payloads grandes (como o array de mensagens final) DEVEM ser truncados/sanitizados antes de salvar no `debug_logs` para evitar estouro de memória e timeouts.

### 🛡️ 5. Persistência de Respostas
- **Always Save**: Toda resposta gerada pela IA (aiText) deve ser persistida na tabela `messages` com `from_me: true`.

---
*Assinado: Antigravity - Versão Blindada V10 (The Shield)*
