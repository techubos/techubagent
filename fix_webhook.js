
import https from 'https';

const CONFIG = {
    apiKey: '429683C4C977415CAAFCCE10F7D57E11',
    baseUrl: 'https://evolution.gamacreativedesign.com.br',
    instanceName: 'teclab',
    webhookUrl: 'https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/evolution-webhook'
};

const setWebhook = () => {
    console.log(`Setting webhook for ${CONFIG.instanceName} to ${CONFIG.webhookUrl}...`);

    const url = `${CONFIG.baseUrl}/webhook/set/${CONFIG.instanceName}`;
    const options = {
        method: 'POST',
        headers: {
            'apikey': CONFIG.apiKey,
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log("Response:", data);
        });
    });

    req.on('error', e => console.error("Error:", e));
    req.write(JSON.stringify({
        webhook: {
            enabled: true,
            url: CONFIG.webhookUrl,
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
        }
    }));
    req.end();
};

setWebhook();
