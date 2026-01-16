
const supabaseUrl = "https://eqoefszhqllengnvjbrm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjEzMiwiZXhwIjoyMDgzNDcyMTMyfQ.z03uiVa5HSL9XcTBYSBzoLGDyomduf_uHtS98HF6nno";
const orgId = "e5c17522-5779-49ba-93e1-c6445f341e1a";

async function massSync() {
    console.log(`[Mass Sync] Target Org: ${orgId}`);

    const res = await fetch(`${supabaseUrl}/rest/v1/contacts?organization_id=eq.${orgId}&select=id,phone`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Mass Sync] Error fetching contacts: ${res.status}`, err);
        return;
    }

    const contacts = await res.json();
    console.log(`[Mass Sync] Processing ${contacts.length} contacts...`);

    for (const contact of contacts) {
        console.log(`[Mass Sync] -> Syncing ${contact.phone} (${contact.id})`);
        try {
            const syncRes = await fetch(`${supabaseUrl}/functions/v1/evolution-sync-history`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contactId: contact.id, phone: contact.phone, limit: 100 })
            });
            const data = await syncRes.json();
            console.log(`[Mass Sync] Result for ${contact.phone}:`, data.success ? `DONE (Synced ${data.synced} msgs)` : `FAIL (${data.error})`);
        } catch (e) {
            console.error(`[Mass Sync] RPC Error for ${contact.phone}:`, e.message);
        }
    }
    console.log("[Mass Sync] COMPLETED.");
}

massSync();
