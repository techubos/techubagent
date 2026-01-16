
// PROBE CLONE - EXACT LOGIC FROM STEP 2676
const key = '429683C4C977415CAAFCCE10F7D57E11';
const base = 'https://evolution.gamacreativedesign.com.br';
const u = '/chat/findMessages/gama';
const body = JSON.stringify({ number: '553199630882', limit: 1, count: 1 });

async function run() {
    try {
        console.log("Fetching...");
        const r = await fetch(base + u, {
            method: 'POST',
            headers: { 'apikey': key, 'Content-Type': 'application/json' },
            body
        });
        console.log(u, r.status);
        const data = await r.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
