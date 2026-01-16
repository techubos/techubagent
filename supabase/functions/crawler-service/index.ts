import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { url, organizationId, category = 'website' } = await req.json()

        if (!url) throw new Error("URL is required")

        console.log(`[CRAWLER] Starting scrape for: ${url}`)

        // 1. Fetch the URL content
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch URL: ${res.statusText}`)

        const html = await res.text()

        // 2. Rudimentary Clean (Remove scripts and styles)
        const cleanContent = html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000); // Limit size for initial version

        // 3. (Optional) Use LLM to create a meaningful title and clean summary
        const aiPrompt = `
        Analise o texto extraído de uma URL abaixo e retorne um objeto JSON limpo com:
        {
          "title": "Um título curto e profissional para este conteúdo",
          "clean_summary": "O conteúdo principal limpo, focado em informações úteis (remova menus, links de rodapé, etc)"
        }
        
        Texto extraído:
        ${cleanContent.substring(0, 4000)}
        `

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: aiPrompt }],
                response_format: { type: "json_object" }
            })
        })

        const aiData = await aiRes.json()
        const { title, clean_summary } = JSON.parse(aiData.choices[0].message.content)

        // 4. Generate Embedding for RAG
        const embRes = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: clean_summary,
                model: 'text-embedding-3-small'
            })
        })
        const embData = await embRes.json()
        const embedding = embData.data[0].embedding

        // 5. Save to Documents Table
        const { data: newDoc, error: docError } = await supabase
            .from('documents')
            .insert({
                title: title || `Scrape: ${url}`,
                content: clean_summary,
                category: category,
                organization_id: organizationId,
                is_active: true,
                version: 1,
                embedding: embedding,
                metadata: { source_url: url, scraped_at: new Date().toISOString() }
            })
            .select()
            .single()

        if (docError) throw docError

        return new Response(JSON.stringify({ success: true, docId: newDoc.id, title: newDoc.title }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("[CRAWLER-ERR]", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
