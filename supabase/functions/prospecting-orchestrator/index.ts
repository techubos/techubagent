import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2.39.0/dist/module/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        const { action, payload } = await req.json();

        // Fetch APIFY_TOKEN from settings if not provided in environment
        let apifyToken = Deno.env.get("APIFY_TOKEN");
        if (!apifyToken) {
            const { data: settings } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'agent_config')
                .single();

            apifyToken = settings?.value?.apiKeys?.apify;
        }

        if (!apifyToken) throw new Error("Token do Apify não configurado. Vá em Configurações > API e adicione seu token.");

        if (action === "pulse") {
            // ACTION: Pulse - Checks for recurring radar campaigns
            console.log("💓 Radar Pulse: Checking for recurring campaigns...");
            const { data: radarCampaigns } = await supabase
                .from('prospecting_campaigns')
                .select('*')
                .eq('is_radar', true)
                .in('status', ['completed', 'ready']);

            if (!radarCampaigns?.length) return new Response(JSON.stringify({ message: "No radar tasks" }), { headers: corsHeaders });

            for (const camp of radarCampaigns) {
                const lastRun = camp.last_run_at ? new Date(camp.last_run_at).getTime() : 0;
                const coolingPeriod = 24 * 60 * 60 * 1000; // 24h recurrence

                if (Date.now() - lastRun > coolingPeriod) {
                    console.log(`🚀 Triggering Radar for: ${camp.name}`);
                    // Re-trigger the search based on type
                    const payload = camp.metadata?.search_payload;
                    if (camp.type === 'instagram') {
                        await fetch(`${SUPABASE_URL}/functions/v1/prospecting-orchestrator`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'start_instagram', payload: { ...payload, campaignId: camp.id } })
                        });
                    } else if (camp.type === 'google_maps') {
                        await fetch(`${SUPABASE_URL}/functions/v1/outscraper-search`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...payload, campaignId: camp.id })
                        });
                    }

                    await supabase.from('prospecting_campaigns').update({ last_run_at: new Date().toISOString() }).eq('id', camp.id);
                }
            }
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        if (action === "start_instagram") {
            const { hashtag, location, limit = 50, campaignId } = payload;

            // 1. Trigger Apify Actor (apify/instagram-scraper)
            const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${apifyToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    "addParentData": false,
                    "directUrls": [],
                    "enhanceUserBySearchField": false,
                    "isOptimizeImageStorage": false,
                    "isRunAndOutputOnlyForSpecificItems": false,
                    "resultsLimit": limit,
                    "resultsType": "details",
                    "searchLimit": 1,
                    "searchType": hashtag ? "hashtag" : "place",
                    "searchQueries": [hashtag || location]
                }),
            });

            const runData = await response.json();

            if (!response.ok) throw new Error(`Apify Error: ${runData.message || 'Unknown error'}`);

            // 2. Update campaign with run ID
            await supabase
                .from("prospecting_campaigns")
                .update({ status: "running", apify_run_id: runData.data.id })
                .eq("id", campaignId);

            return new Response(JSON.stringify({ success: true, runId: runData.data.id }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "sync_results") {
            const { campaignId, runId } = payload;

            // 1. Fetch results from Apify
            const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`);
            const items = await response.json();

            let validCount = 0;

            for (const item of items) {
                // Lead Cleaning Logic
                const bio = item.biography || "";
                const externalUrl = item.externalUrl || "";

                let whatsapp = "";

                // Match wa.me or api.whatsapp links
                const waMatch = externalUrl.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/);
                if (waMatch) {
                    whatsapp = waMatch[1].replace(/\D/g, "");
                } else {
                    // Fallback: look for phone pattern in bio
                    const phoneInBio = bio.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/);
                    if (phoneInBio) {
                        whatsapp = phoneInBio[0].replace(/\D/g, "");
                    }
                }

                // Only insert if we found something or if it's a high-quality lead
                if (whatsapp || item.followersCount > 500) {
                    if (whatsapp && !whatsapp.startsWith("55") && whatsapp.length >= 10) {
                        whatsapp = "55" + whatsapp; // Normalize to Brazil
                    }

                    const { error: insertError } = await supabase.from("leads").insert({
                        name: item.fullName || item.username,
                        phone: whatsapp || null,
                        instagram: `https://instagram.com/${item.username}`,
                        category: item.businessCategoryName || "Cell Shop",
                        status: "pending",
                        campaign_id: campaignId,
                        metadata: {
                            bio,
                            followers: item.followersCount,
                            external_url: externalUrl,
                            profile_pic: item.profilePicUrl
                        }
                    });

                    if (!insertError && whatsapp) validCount++;
                }
            }

            await supabase
                .from("prospecting_campaigns")
                .update({ status: "completed", valid_leads: validCount, total_leads: items.length })
                .eq("id", campaignId);

            return new Response(JSON.stringify({ success: true, validCount }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: corsHeaders
        });
    }
});
