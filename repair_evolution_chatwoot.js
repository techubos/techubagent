
async function repairIntegration() {
    const evoUrl = "https://evolution.gamacreativedesign.com.br";
    const evoKey = "429683C4C977415CAAFCCE10F7D57E11";
    const cwUrl = "https://chat.gamacreativedesign.com.br";
    const cwToken = "xTsRfCceqxz7ftKLzJr9T2TS";
    const instance = "gama";

    console.log(`[Repair] Setting Chatwoot for instance: ${instance}...`);

    try {
        const res = await fetch(`${evoUrl}/chatwoot/set/${instance}`, {
            method: 'POST',
            headers: {
                'apikey': evoKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: true,
                accountId: "1",
                token: cwToken,
                url: cwUrl,
                inboxId: "7",
                signMsg: false,
                reopenConversation: true,
                conversationPending: false,
                importMessages: true
            })
        });

        const data = await res.json();
        console.log("[Repair] Result:", JSON.stringify(data, null, 2));

        if (res.ok) {
            console.log("✅ Integração reparada com sucesso!");
        } else {
            console.error("❌ Falha ao reparar integração");
        }
    } catch (err) {
        console.error("💥 Erro fatal no reparo:", err);
    }
}

repairIntegration();
