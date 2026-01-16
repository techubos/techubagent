
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

// Função auxiliar para carregar o .env manualmente e evitar dependências
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.join('=').trim();
            }
        });
    } catch (e) {
        console.warn("⚠️ Não foi possível carregar o arquivo .env");
    }
}

loadEnv();

const CHATWOOT_URL = process.env.VITE_CHATWOOT_API_URL;
const CHATWOOT_TOKEN = process.env.VITE_CHATWOOT_API_TOKEN;
const EVOLUTION_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.VITE_EVOLUTION_API_KEY;
const INSTANCE_NAME = "teclab";

async function request(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) reject(new Error(JSON.stringify(parsed)));
                    else resolve(parsed);
                } catch (e) {
                    reject(new Error(data));
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

async function provision() {
    console.log("🚀 Iniciando provisionamento automático...");

    try {
        if (!CHATWOOT_URL || !CHATWOOT_TOKEN) {
            throw new Error("Credenciais do Chatwoot faltando no .env");
        }

        const chatwootToken = CHATWOOT_TOKEN;
        const chatwootUrl = CHATWOOT_URL.endsWith('/') ? CHATWOOT_URL.slice(0, -1) : CHATWOOT_URL;
        const evolutionUrl = EVOLUTION_URL.endsWith('/') ? EVOLUTION_URL.slice(0, -1) : EVOLUTION_URL;

        // 1. Criar Caixa de Entrada API no Chatwoot
        console.log("📬 Criando Caixa de Entrada no Chatwoot...");
        const inboxData = await request(`${chatwootUrl}/api/v1/accounts/1/inboxes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api_access_token': chatwootToken },
            body: { name: "WhatsApp TecHub", channel: { type: "api" } }
        });

        const inboxId = inboxData.id;
        console.log(`✅ Caixa de Entrada criada! ID: ${inboxId}`);

        // 2. Configurar Evolution para usar esta Inbox
        console.log("🔗 Vinculando Evolution ao Chatwoot...");
        await request(`${evolutionUrl}/chatwoot/set/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
            body: {
                enabled: true,
                url: chatwootUrl,
                accountId: "1",
                token: chatwootToken,
                signMsg: true,
                signDelimiter: "\n",
                reopenConversation: true,
                conversationPending: false,
                inboxId: String(inboxId)
            }
        });

        console.log("✅ Evolution configurada com sucesso!");

        // 3. Configurar Webhook no Chatwoot
        console.log("🛰️ Configurando Webhook no Chatwoot...");
        try {
            await request(`${chatwootUrl}/api/v1/accounts/1/webhooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api_access_token': chatwootToken },
                body: {
                    url: "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/chatwoot-webhook",
                    subscriptions: ["message_created", "message_updated"]
                }
            });
            console.log("✅ Webhook configurado!");
        } catch (e) {
            console.log("⚠️ Webhook já existia ou erro menor ignorado.");
        }

        console.log("✨ Provisionamento concluído! Tudo pronto.");

    } catch (err) {
        console.error("❌ Erro durante o provisionamento:", err.message);
    }
}

provision();
