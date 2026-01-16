
import "dotenv/config";

const CHATWOOT_URL = process.env.VITE_CHATWOOT_API_URL;
const CHATWOOT_TOKEN = process.env.VITE_CHATWOOT_API_TOKEN;
const EVOLUTION_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.VITE_EVOLUTION_API_KEY;

// No Windows, o usuário tem a instância 'Gama' ou similar conforme a URL
const INSTANCE_NAME = "Gama";

async function provision() {
    console.log("🚀 Iniciando provisionamento automático...");

    try {
        // 1. Criar Caixa de Entrada API no Chatwoot
        console.log("📬 Criando Caixa de Entrada no Chatwoot...");
        const inboxRes = await fetch(`${CHATWOOT_URL}/api/v1/accounts/1/inboxes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': CHATWOOT_TOKEN!
            },
            body: JSON.stringify({
                name: "WhatsApp TecHub",
                channel: {
                    type: "api"
                }
            })
        });

        const inboxData = await inboxRes.json();
        if (!inboxRes.ok) throw new Error(`Falha ao criar inbox: ${JSON.stringify(inboxData)}`);

        const inboxId = inboxData.id;
        console.log(`✅ Caixa de Entrada criada! ID: ${inboxId}`);

        // 2. Configurar Evolution para usar esta Inbox
        console.log("🔗 Vinculando Evolution ao Chatwoot...");
        const evoRes = await fetch(`${EVOLUTION_URL}/chatwoot/set/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_KEY!
            },
            body: JSON.stringify({
                enabled: true,
                url: CHATWOOT_URL,
                account_id: 1,
                token: CHATWOOT_TOKEN,
                sign_msg: true,
                sign_delimiter: "\n",
                allow_nas: false,
                inbox_id: inboxId
            })
        });

        const evoData = await evoRes.json();
        if (!evoRes.ok) throw new Error(`Falha ao configurar Evolution: ${JSON.stringify(evoData)}`);

        console.log("✅ Evolution configurada com sucesso!");

        // 3. Configurar Webhook no Chatwoot (Caso não tenha sido feito manual)
        console.log("🛰️ Configurando Webhook no Chatwoot...");
        const webhookRes = await fetch(`${CHATWOOT_URL}/api/v1/accounts/1/webhooks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': CHATWOOT_TOKEN!
            },
            body: JSON.stringify({
                url: "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/chatwoot-webhook",
                subscriptions: ["message_created", "message_updated"]
            })
        });

        console.log("✨ Provisionamento concluído! Tudo pronto.");

    } catch (err) {
        console.error("❌ Erro durante o provisionamento:", err);
    }
}

provision();
