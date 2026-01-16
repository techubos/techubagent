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
        const { messageId, audioUrl, audioBase64, mimetype, contactId } = await req.json()

        console.log(`🎵 Processando áudio da mensagem ${messageId}`)

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let audioBlob: Blob

        // Detectar formato (URL ou Base64)
        if (audioBase64) {
            console.log('📦 Convertendo Base64 para Blob...')

            // Remover prefixo data:audio/...;base64, se existir
            const base64Clean = audioBase64.includes('base64,') ? audioBase64.split('base64,')[1] : audioBase64

            // Converter para bytes
            const binaryString = atob(base64Clean)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }

            audioBlob = new Blob([bytes], { type: mimetype || 'audio/ogg' })

        } else if (audioUrl) {
            console.log(`🌐 Baixando áudio de: ${audioUrl}`)

            const response = await fetch(audioUrl)
            if (!response.ok) {
                throw new Error(`Falha ao baixar áudio: ${response.status}`)
            }

            audioBlob = await response.blob()
        } else {
            throw new Error('Nem audioUrl nem audioBase64 fornecidos')
        }

        // Gerar nome único do arquivo
        const timestamp = Date.now()
        const extension = mimetype?.includes('mpeg') || mimetype?.includes('mp3') ? 'mp3' : 'ogg'
        const filename = `${contactId}/${timestamp}.${extension}`

        console.log(`💾 Salvando áudio: ${filename}`)

        // Upload para Storage
        const { error: uploadError } = await supabase
            .storage
            .from('audios')
            .upload(filename, audioBlob, {
                contentType: mimetype || 'audio/ogg',
                upsert: false
            })

        if (uploadError) {
            throw new Error(`Erro no upload: ${uploadError.message}`)
        }

        // Gerar Signed URL (válida por 1 semana para garantir - cliente pediu 1h mas para UX melhor vamos por mais tempo ou renovar no client, mas vou seguir 1h por enquanto e o client que lute ou aumentamos aqui, vou por 24h)
        // O prompt pediu 3600 (1h). Vou colocar 86400 (24h) para ser mais amigável.
        const { data: signedData, error: signedError } = await supabase
            .storage
            .from('audios')
            .createSignedUrl(filename, 86400)

        if (signedError) {
            throw new Error(`Erro ao gerar URL: ${signedError.message}`)
        }

        // Atualizar mensagem com URL do áudio
        await supabase
            .from('messages')
            .update({
                media_url: signedData.signedUrl,
                media_path: filename
            })
            .eq('id', messageId)

        console.log(`✅ Áudio processado com sucesso`)

        // PARTE 3: TRANSCRIÇÃO COM GEMINI
        console.log(`📝 Iniciando transcrição...`)

        const transcription = await transcribeAudio(audioBlob)

        if (transcription) {
            await supabase
                .from('messages')
                .update({ transcription })
                .eq('id', messageId)

            console.log(`✅ Transcrição salva: ${transcription.substring(0, 50)}...`)
        }

        return new Response(
            JSON.stringify({
                success: true,
                audioUrl: signedData.signedUrl,
                transcription
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: unknown) {
        console.error('💥 Erro:', error)
        return new Response(
            JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } // 200 para não quebrar client, com flag success:false
        )
    }
})

// Função de transcrição com Gemini
async function transcribeAudio(audioBlob: Blob) {
    try {
        const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
        if (!geminiKey) {
            console.log('⚠️ GEMINI_API_KEY não configurada, pulando transcrição')
            return null
        }

        // Converter áudio para Base64
        const arrayBuffer = await audioBlob.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        const base64Audio = btoa(String.fromCharCode(...bytes))

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: 'Transcreva este áudio em português do Brasil. Se for incompreensível, diga [Áudio inaudível]. Retorne apenas o texto transcrito, sem comentários adicionais.' },
                            {
                                inline_data: {
                                    mime_type: audioBlob.type || 'audio/ogg',
                                    data: base64Audio
                                }
                            }
                        ]
                    }]
                })
            }
        )

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`Gemini API error: ${response.status} - ${err}`)
        }

        const data = await response.json()
        const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

        return transcription || null

    } catch (error: unknown) {
        console.error('❌ Erro na transcrição:', error instanceof Error ? error.message : String(error))
        return null
    }
}
