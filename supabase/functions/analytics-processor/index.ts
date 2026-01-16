import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { OpenAI } from "https://esm.sh/openai@4.24.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    try {
        // --- SECURITY: Verify JWT ---
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) throw new Error('Unauthorized');
        // ---------------------------

        const { messageId, contactId, organizationId, content, role } = await req.json();

        if (!messageId || !organizationId) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        let sentiment = 'neutral';
        let responseTimeSeconds = 0;

        // 1. Sentiment Analysis (only for user messages)
        if (role === 'user' && content) {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Analyze the sentiment of the following message. Respond with ONLY one word: positive, neutral, or negative."
                    },
                    { role: "user", content: content }
                ],
                max_tokens: 5
            });

            const aiSentiment = completion.choices[0].message.content?.toLowerCase().trim();
            if (['positive', 'neutral', 'negative'].includes(aiSentiment || '')) {
                sentiment = aiSentiment as any;
            }

            // Update message with sentiment
            await supabase.from('messages').update({ sentiment }).eq('id', messageId);
        }

        // 2. Calculate Response Time
        // Find the previous message to calculate the gap
        const { data: prevMsg } = await supabase
            .from('messages')
            .select('created_at, role')
            .eq('contact_id', contactId)
            .lt('created_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (prevMsg && prevMsg.role !== role) {
            const currentAt = new Date().getTime();
            const prevAt = new Date(prevMsg.created_at).getTime();
            responseTimeSeconds = Math.floor((currentAt - prevAt) / 1000);

            // Update message with response time
            await supabase.from('messages').update({ response_time_seconds: responseTimeSeconds }).eq('id', messageId);
        }

        // 3. Upsert Daily Stats
        const today = new Date().toISOString().split('T')[0];

        // We use a RPC or specialized logic to handle atomic increments if possible, 
        // but for now, we'll do a select + upsert.
        const { data: stats } = await supabase
            .from('analytics_daily_stats')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('date', today)
            .maybeSingle();

        if (stats) {
            const updates: any = {
                total_messages: stats.total_messages + 1,
                ai_messages: stats.ai_messages + (role === 'assistant' ? 1 : 0),
                human_messages: stats.human_messages + (role === 'human' ? 1 : 0),
                positive_messages: stats.positive_messages + (sentiment === 'positive' ? 1 : 0),
                neutral_messages: stats.neutral_messages + (sentiment === 'neutral' ? 1 : 0),
                negative_messages: stats.negative_messages + (sentiment === 'negative' ? 1 : 0),
            };

            // Rolling average for response time
            if (responseTimeSeconds > 0) {
                updates.avg_response_time = (stats.avg_response_time * stats.total_messages + responseTimeSeconds) / (stats.total_messages + 1);
            }

            // Estimated ROI: Assume $2 per AI message (cost of a human minute)
            updates.estimated_roi = updates.ai_messages * 2.00;

            await supabase.from('analytics_daily_stats').update(updates).eq('id', stats.id);
        } else {
            await supabase.from('analytics_daily_stats').insert({
                organization_id: organizationId,
                date: today,
                total_messages: 1,
                ai_messages: (role === 'assistant' ? 1 : 0),
                human_messages: (role === 'human' ? 1 : 0),
                positive_messages: (sentiment === 'positive' ? 1 : 0),
                neutral_messages: (sentiment === 'neutral' ? 1 : 0),
                negative_messages: (sentiment === 'negative' ? 1 : 0),
                avg_response_time: responseTimeSeconds,
                estimated_roi: (role === 'assistant' ? 2.00 : 0)
            });
        }

        return new Response(JSON.stringify({ success: true, sentiment, responseTimeSeconds }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Analytics Processor Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
