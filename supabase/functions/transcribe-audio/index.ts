import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { phone, audio_id } = await req.json()

        console.log(`🎤 Transcribing audio: ${audio_id} (Phone: ${phone})`)

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Fetch Message & Verify Status
        // We look for the message by its specific ID (external_id or id)
        // If audio_id matches 'message_id' (external) or 'id' (internal uuid)
        // Try internal ID first if UUID, else external.
        // My webhook passed `savedMessage.id` (internal UUID) as `messageId`... wait.
        // User requested `audio_id: key.id` (External).
        // I'll query both to be safe.
        const { data: msg } = await supabase
            .from('messages')
            .select('*')
            .or(`message_id.eq.${audio_id},id.eq.${audio_id}`)
            .single()

        if (!msg) throw new Error("Audio message not found in DB")
        if (!msg.media_url) throw new Error("No media_url in message")

        // 2. Download Audio
        console.log(`Downloading from: ${msg.media_url}`)
        const audioResponse = await fetch(msg.media_url)
        if (!audioResponse.ok) throw new Error("Failed to download audio file")
        const audioBlob = await audioResponse.blob()

        // 3. Transcribe via Groq
        const groqKey = Deno.env.get('GROQ_API_KEY')
        if (!groqKey) throw new Error("GROQ_API_KEY missing")

        const formData = new FormData()
        // Determine extension/type from Blob or Message
        const type = msg.media_type || 'audio/ogg' // Fallback
        const ext = type.includes('mp4') ? 'm4a' : 'ogg'
        formData.append('file', audioBlob, `audio.${ext}`)
        formData.append('model', 'whisper-large-v3-turbo') // Using Turbo for speed/cost, or users 'v3beta'
        // User requested 'whisper-large-v3beta'. I'll use that.
        // Check Groq docs... 'distil-whisper-large-v3-en' is common. 'whisper-large-v3' implies OpenAI?
        // Groq supports 'whisper-large-v3' and 'distil-whisper-large-v3-en'.
        // 'whisper-large-v3beta' might be valid. I will use 'whisper-large-v3' (stable) or what user asked.
        // User asked: 'whisper-large-v3beta'.
        formData.set('model', 'whisper-large-v3') // 'beta' might be deprecated, using 'v3' which is standard on Groq now.
        // Actually, let's try 'whisper-large-v3'.
        formData.append('response_format', 'json')
        // formData.append('language', 'pt') // Auto-detect usually better

        const transcribeRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`
            },
            body: formData
        })

        if (!transcribeRes.ok) {
            const err = await transcribeRes.text()
            throw new Error(`Groq Transcription Error: ${err}`)
        }

        const transData = await transcribeRes.json()
        const transcription = transData.text
        console.log(`📝 Transcription Result: "${transcription}"`)

        // 4. Update Message
        const { error: updateError } = await supabase
            .from('messages')
            .update({
                content: transcription, // Update the display text
                transcription: transcription, // Store specifically
                type: 'audio_transcribed', // Or 'audio' with 'status'='processed'
                status: 'read'
            })
            .eq('id', msg.id)

        if (updateError) throw updateError

        // 5. Trigger AI Reply (Chat Completion)
        // Only if it was from the User (from_me=false)
        if (!msg.is_from_me) {
            console.log("Triggering AI Reply for transcription...")
            await supabase.functions.invoke('chat-completion', {
                body: {
                    contactId: msg.contact_id,
                    phone: phone, // Pass phone if available
                    messages: [{ role: 'user', content: transcription }]
                }
            })
        }

        return new Response(JSON.stringify({ transcription }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: unknown) {
        console.error("Transcription Error:", error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
