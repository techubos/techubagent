
# Ferramenta de Sincronização Manual (Evolution -> Supabase)

Este script permite baixar o histórico de mensagens da Evolution API diretamente para o banco de dados Supabase local. Útil quando o sistema automático falha ou para popular o banco inicialmente.

## Pré-requisitos

1. Certifique-se de estar na pasta raiz do projeto.
2. Instale as dependências necessárias:

```bash
npm install axios chalk progress dotenv prompt-sync
```

## Como Usar

Rode o script via terminal:

```bash
node scripts/manual-sync.js
```

## O que ele faz?
1. Detecta sua organização automaticamente (ou pede o ID).
2. Pergunta se você quer sincronizar um número específico ou TODOS.
3. Conecta na Evolution API e baixa as últimas 50 mensagens de cada contato.
4. Salva no Supabase (ignorando duplicatas).
5. Mostra uma barra de progresso colorida.

## Solução de Problemas
- **Erro 401/403 no Supabase:** Certifique-se de que o arquivo `.env` tem `VITE_SUPABASE_ANON_KEY`. O script pede a `SERVICE_ROLE_KEY` se quiser permissões administrativas completas (recomendado para evitar bloqueios de RLS).
- **Erro na Evolution:** Verifique se o `EVOLUTION_API_URL` está correto no `.env`.
