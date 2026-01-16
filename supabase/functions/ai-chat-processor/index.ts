// AI CHAT PROCESSOR v2.0 (RAG + Typing + Splitting)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { sanitizePhone, sanitizeMessage } from "../_shared/sanitize.ts";

const normalizeUrl = (u: string | undefined) => u ? u.replace(/\/+$/, "") : "";

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const { contact_id, delay = 1000, organization_id, source = 'evolution' } = payload;

        const processJob = async () => {
            console.log(`[AI-PROCESSOR] Job started for contact ${contact_id}`);
            try {
                // --- CONFIGURATION ---
                const SPLIT_LIMIT = 200; // User requested ~200 chars
                const MATCH_THRESHOLD = 0.7;
                const MATCH_COUNT = 5;

                const supabaseUrl = normalizeUrl(Deno.env.get('SUPABASE_URL'));
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
                const openaiKey = Deno.env.get('OPENAI_API_KEY');
                const evoUrl = normalizeUrl(Deno.env.get('EVOLUTION_API_URL'));
                const evoKey = Deno.env.get('EVOLUTION_API_KEY');
                const chatwootUrl = normalizeUrl(Deno.env.get('CHATWOOT_API_URL'));
                const chatwootToken = Deno.env.get('CHATWOOT_API_TOKEN');

                const supabase = createClient(supabaseUrl, supabaseKey);

                // 1. Fetch Context (Contact & Agent)
                const { data: contact } = await supabase.from('contacts').select('*').eq('id', contact_id).single();
                if (!contact) {
                    console.error("No contact found");
                    return;
                }

                // Debounce Check
                const dueAt = new Date(contact.ai_response_due_at).getTime();
                if (dueAt - Date.now() > 5000) {
                    console.log("Debounced (future due date)");
                    return;
                }

                const { data: agents } = await supabase.from('agents').select('*').eq('organization_id', organization_id).eq('is_active', true).limit(1);
                const agent = agents?.[0];

                // 2. Fetch History
                const { data: historyData } = await supabase.from('messages')
                    .select('role, content, message_type, payload')
                    .eq('contact_id', contact.id)
                    .order('created_at', { ascending: false })
                    .limit(10); // Context window

                let hasImage = false;
                let lastUserMessage = "";

                const history = (historyData || []).reverse().map((m: any) => {
                    const payload = m.payload || {};
                    // Capture last user text for Embedding
                    if (m.role === 'user' && m.message_type === 'text') lastUserMessage = m.content;

                    if (m.role === 'user' && m.message_type === 'image' && payload.publicUrl) {
                        hasImage = true;
                        return { role: m.role, content: [{ type: "text", text: m.content || "Imagem enviada." }, { type: "image_url", image_url: { url: payload.publicUrl } }] };
                    }
                    return { role: m.role, content: m.content };
                });

                // 3. RAG: Generate Embedding & Search Knowledge Base
                let contextText = "";
                if (lastUserMessage) {
                    try {
                        const embRes = await fetch('https://api.openai.com/v1/embeddings', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ input: lastUserMessage, model: 'text-embedding-3-small' })
                        });
                        const embData = await embRes.json();
                        const embedding = embData.data?.[0]?.embedding;

                        if (embedding) {
                            const { data: memories } = await supabase.rpc('match_memories', {
                                query_embedding: embedding,
                                match_threshold: MATCH_THRESHOLD,
                                match_count: MATCH_COUNT,
                                filter_organization_id: organization_id
                            });

                            if (memories && memories.length > 0) {
                                contextText = "\n\nBASE DE CONHECIMENTO (Use isso para responder):\n" +
                                    memories.map((m: any) => `- ${m.content}`).join("\n");
                                console.log("RAG Hits:", memories.length);
                            }
                        }
                    } catch (err) {
                        console.error("RAG Error:", err);
                    }
                }

                // 4. Construct System Prompt (Enhanced)
                const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                const systemContent = `
                ${agent?.system_prompt || "Você é um assistente virtual experiente, proativo e profissional."}
                
                [CONTEXTO ATUAL]
                - Data/Hora: ${now}
                
                [DIRETRIZES DE PERSONALIDADE "HUMANIZADA"]
                1. **Espelhamento de Emoção:** Se o usuário estiver frustrado, seja calmo e resolutivo. Se estiver feliz, seja entusiasta.
                2. **Inteligência de Formato:**
                - Se o usuário mandou ÁUDIO: Responda de forma mais conversacional, como se estivesse falando (pois sua resposta será convertida em voz). Evite listas longas ou caracteres especiais complexos.
                - Se o usuário mandou TEXTO CURTO: Seja direto.
                3. **Proatividade:** Não espere o cliente perguntar tudo. Se ele pedir preço, já ofereça as formas de pagamento.
                4. **Visão:** Se houver imagens, comente detalhes específicos delas para mostrar que você está "vendo".

                ${hasImage ? "- VISÃO ATIVA: O usuário enviou uma imagem. Descreva o que vê e responda à pergunta sobre ela." : ""}
                ${contextText ? `\n[MEMÓRIA DO NEGÓCIO]\n${contextText}` : ""}
                `.trim();

                const messages = [{ role: 'system', content: systemContent }, ...history];

                // FORCE GPT-4o for "Smart" mode (User complained about intelligence)
                // Only use mini if explicitly downgraded in DB, otherwise default to flagship
                const model = hasImage ? 'gpt-4o' : (agent?.model || 'gpt-4o');
                const temperature = agent?.temperature ?? 0.3;

                // 5. Call LLM
                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, messages, temperature })
                });
                const aiData = await aiRes.json();
                let aiText = aiData.choices?.[0]?.message?.content;

                // Sanitize AI Output
                if (aiText) {
                    aiText = sanitizeMessage(aiText);
                }

                if (!aiText) {
                    console.error("No AI response text");
                    return;
                }

                // 6. Split Messages
                const splitMessages = (text: string, limit: number) => {
                    const chunks = [];
                    let current = text;

                    while (current.length > limit) {
                        // Find best split point (sentence end)
                        let splitIndex = -1;
                        const searchWindow = current.substring(0, limit);

                        // Try priority splitters
                        const matches = [...searchWindow.matchAll(/[.!?\n]/g)];
                        if (matches.length > 0) {
                            // Pick the last one
                            splitIndex = matches[matches.length - 1].index! + 1;
                        } else {
                            // Fallback to space
                            splitIndex = searchWindow.lastIndexOf(' ');
                        }

                        if (splitIndex === -1) splitIndex = limit; // Force split

                        chunks.push(current.substring(0, splitIndex).trim());
                        current = current.substring(splitIndex).trim();
                    }
                    if (current) chunks.push(current);
                    return chunks;
                };

                const chunks = splitMessages(aiText, SPLIT_LIMIT);

                // 7. Send via Evolution API (Optimized Latency)
                const { data: conns } = await supabase.from('connections').select('instance_name').eq('organization_id', organization_id).limit(1);
                const instance = conns?.[0]?.instance_name;

                if (instance) {
                    let phone = sanitizePhone(contact.phone);

                    // --- AUDIO RESPONSE PATH ---
                    const originalHistory = historyData || [];
                    const lastUserMsg = originalHistory.find((m: any) => m.role === 'user');
                    const userPreferAudio = lastUserMsg?.message_type === 'audio';

                    if (userPreferAudio && aiText) {
                        // 1. Generate Audio (OpenAI TTS)
                        const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: "tts-1",
                                input: aiText.substring(0, 4096),
                                voice: "alloy"
                            })
                        });

                        if (ttsRes.ok) {
                            const audioArrayBuffer = await ttsRes.arrayBuffer();
                            const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });

                            // 2. Upload to Supabase Storage
                            const fileName = `audio_response_${Date.now()}_${contact.id}.mp3`;
                            const { error: uploadError } = await supabase.storage.from('media').upload(fileName, audioBlob, {
                                contentType: 'audio/mpeg',
                                upsert: true
                            });

                            if (!uploadError) {
                                const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(fileName);
                                const audioUrl = publicUrlData.publicUrl;

                                // 3. Send Audio via Source
                                if (source === 'chatwoot' && chatwootUrl && chatwootToken) {
                                    const { data: lastMsg } = await supabase.from('messages')
                                        .select('payload')
                                        .eq('contact_id', contact.id)
                                        .order('created_at', { ascending: false })
                                        .limit(1)
                                        .single();

                                    const convId = lastMsg?.payload?.chatwoot_conversation_id;
                                    const accId = lastMsg?.payload?.chatwoot_account_id || '1';

                                    if (convId) {
                                        await fetch(`${chatwootUrl}/api/v1/accounts/${accId}/conversations/${convId}/messages`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'api_access_token': chatwootToken },
                                            body: JSON.stringify({ content: aiText, attachments: [audioUrl], message_type: 'outgoing' })
                                        });
                                    }
                                } else {
                                    // Fallback to Evolution
                                    await fetch(`${evoUrl}/message/sendVoice/${instance}`, {
                                        method: 'POST',
                                        headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ number: phone, url: audioUrl })
                                    });
                                }

                                // 4. Log to DB (as Audio)
                                await supabase.from('messages').insert({
                                    phone, role: 'assistant', content: aiText, from_me: true,
                                    message_type: 'audio', organization_id, contact_id: contact.id
                                });

                                // Done
                                await supabase.from('contacts').update({ ai_response_due_at: null }).eq('id', contact.id);
                                return;
                            }
                        }
                    }

                    // --- TEXT RESPONSE PATH (Fallback or Default) ---
                    for (const chunk of chunks) {
                        if (!chunk) continue;

                        // A. Send Typing Presence
                        await fetch(`${evoUrl}/message/sendPresence/${instance}`, {
                            method: 'POST',
                            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ number: phone, presence: 'composing', delay: 3000 })
                        }).catch(e => console.error("Presence Error", e));

                        // Otimização: Digitação mais rápida (1s a 3s máx) para sensação "Snappy"
                        const typeDelay = Math.min(Math.max(chunk.length * 15, 1000), 3000);
                        await new Promise(r => setTimeout(r, typeDelay));

                        // B. Send Text via Source
                        if (source === 'chatwoot' && chatwootUrl && chatwootToken) {
                            const { data: lastMsg } = await supabase.from('messages')
                                .select('payload')
                                .eq('contact_id', contact.id)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .single();

                            const convId = lastMsg?.payload?.chatwoot_conversation_id;
                            const accId = lastMsg?.payload?.chatwoot_account_id || '1';

                            if (convId) {
                                await fetch(`${chatwootUrl}/api/v1/accounts/${accId}/conversations/${convId}/messages`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'api_access_token': chatwootToken },
                                    body: JSON.stringify({ content: chunk, message_type: 'outgoing' })
                                });
                            }
                        } else {
                            await fetch(`${evoUrl}/message/sendText/${instance}`, {
                                method: 'POST',
                                headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ number: phone, text: chunk })
                            });
                        }

                        // C. Log to DB
                        await supabase.from('messages').insert({
                            phone, role: 'assistant', content: chunk, from_me: true, message_type: 'text',
                            organization_id, contact_id: contact.id
                        });

                        // Pause between chunks
                        if (chunks.length > 1) await new Promise(r => setTimeout(r, 2000));
                    }
                }

                // 8. Trigger Lead Scoring (Async)
                fetch(`${supabaseUrl}/functions/v1/analyze-lead-sentiment`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact_id: contact.id })
                }).catch(err => console.error("Lead Score Trigger Error:", err));

                await supabase.from('contacts').update({ ai_response_due_at: null }).eq('id', contact.id);

            } catch (innerErr) {
                console.error("[AI-PROCESSOR] Background Job Error:", innerErr);
            }
        };

        // --- BACKGROUND EXECUTION ---
        // Return OK immediately so the webhook/caller doesn't time out.
        // The actual work happens in the background.
        if ((globalThis as any).EdgeRuntime?.waitUntil) {
            (globalThis as any).EdgeRuntime.waitUntil(processJob());
        } else {
            processJob(); // Fallback for local testing, though risky for timeout
        }

        return new Response('Queued', { status: 200 });

    } catch (e: any) {
        console.error(e);
        return new Response(e.message, { status: 500 });
    }
});
