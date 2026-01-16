# Guia de Configuração: Integração Google Calendar 📅

Para que o TecHub Agent possa agendar reuniões, você precisa criar um projeto no Google Cloud e obter as credenciais.

## Passo 1: Criar Projeto no Google Cloud
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto (ex: `TecHub Agent`).

## Passo 2: Ativar a API
1. No menu lateral, vá em **APIs e Serviços** > **Biblioteca**.
2. Pesquise por **"Google Calendar API"**.
3. Clique em **Ativar**.

## Passo 3: Tela de Consentimento OAuth
1. Vá em **APIs e Serviços** > **Tela de permissão OAuth**.
2. Selecione **Externo** e clique em **Criar**.
3. Preencha:
   - **Nome do App**: TecHub Agent
   - **Email de suporte**: Seu email
4. Clique em **Salvar e Continuar**.
5. **Escopos**: Clique em **Adicionar ou Remover Escopos**.
   - Procure e selecione: `.../auth/calendar` e `.../auth/calendar.events`.
   - Clique em **Atualizar** e depois **Salvar**.
6. **Usuários de Teste**: Adicione seu próprio email gmail para poder testar.

## Passo 4: Criar Credenciais
1. Vá em **APIs e Serviços** > **Credenciais**.
2. Clique em **+ Criar Credenciais** > **ID do cliente OAuth**.
3. **Tipo de Aplicação**: Aplicação Web.
4. **URIs de redirecionamento autorizados** (MUITO IMPORTANTE):
   
   Adicione exatamente esta URL:
   ```
   https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/integrations-auth/callback
   ```

5. Clique em **Criar**.

## Passo 5: Configurar o TecHub Agent
Agora você terá o **ID do Cliente** e a **Chave Secreta do Cliente**.
Execute os comandos abaixo no terminal do seu projeto (VS Code), substituindo pelos seus valores:

```powershell
npx supabase secrets set GOOGLE_CLIENT_ID="SEU_ID_AQUI"
npx supabase secrets set GOOGLE_CLIENT_SECRET="SUA_SENHA_AQUI"
```

## Passo 6 (Opcional): Pipedrive
Se quiser configurar o Pipedrive também:
1. Vá em Pipedrive > Settings > Tools and apps > Marketplace manager.
2. Create new app.
3. Callback URL: A mesma url acima (`.../integrations-auth/callback`).
4. Scopes: `Contacts` (Full access), `Deals` (Full access).
5. Copie Client ID e Client Secret e rode:

```powershell
npx supabase secrets set PIPEDRIVE_CLIENT_ID="SEU_ID_PIPEDRIVE"
npx supabase secrets set PIPEDRIVE_CLIENT_SECRET="SUA_SENHA_PIPEDRIVE"
```
