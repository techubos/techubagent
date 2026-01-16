---
description: Deploy TecHub Agent to VPS using Easypanel
---

# Deploy na VPS com Easypanel

Esta aplicação é um SPA (Single Page Application) em React/Vite. Para rodar em produção, usamos Docker com Nginx.

## Pré-requisitos
1.  Ter o **Easypanel** instalado na sua VPS.
2.  Ter o código do projeto em um repositório Git (GitHub/GitLab).
3.  Ter as chaves do Supabase (`URL` e `ANON_KEY`).

## Passo 1: Preparar o Easypanel
1.  Acesse seu painel Easypanel.
2.  Crie um novo **Project** (ex: `techub`).
3.  Clique em **Service** > **App**.

## Passo 2: Configurar a Fonte (Source)
1.  Selecione **Git**.
2.  Coloque a URL do seu repositório (ex: `https://github.com/seu-usuario/techub-agent`).
3.  Se for privado, configure o Token de Acesso.

## Passo 3: Configurar Variáveis de Ambiente (Build Args)
Como é um app React (Frontend), as chaves precisam ser "chumbadas" no código durante o BUILD.
No Easypanel, procure por **Build Args** (Argumentos de Construção) na aba **Build** ou **General**.

Adicione:
- `VITE_SUPABASE_URL`: (Sua URL do Supabase)
- `VITE_SUPABASE_ANON_KEY`: (Sua Key Anon do Supabase)
- `VITE_GEMINI_API_KEY`: (Sua Key do Gemini)

> **Atenção:** Se o Easypanel só permitir "Environment Variables" (Runtime), verifique se ele injeta no Build. Se não, você precisará usar uma estratégia de `runtime-env` (mais complexo) ou garantir que o Build Args seja suportado.
> *Alternativa:* Se o Easypanel não expor Build Args facilmente, você pode criar um `docker-compose.yml` no repo e usar o deploy por "Docker Compose".

## Passo 4: Deploy
1.  Clique em **Deploy** ou **Save & Deploy**.
2.  Acompanhe os logs.
3.  O Docker vai rodar `npm run build` e depois iniciar o Nginx.

## Troubleshooting
- **Tela Branca/Preta na Produção?**
    - Abra o Console do Navegador (F12).
    - Se vir erros de "Missing Supabase URL", significa que as variáveis não foram injetadas no Build.
    - Verifique se você configurou como **BUILD ARGS** e não apenas Environment Variables de execução.
