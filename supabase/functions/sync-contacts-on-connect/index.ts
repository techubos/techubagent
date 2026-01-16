import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sanitizePhone } from "../_shared/sanitize.ts";

interface EvolutionContact {
  id: string; // Ex: "5511999999999@s.whatsapp.net"
  pushName?: string;
  profilePicUrl?: string;
  image?: string;
  name?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let instance_id, organization_id;

  try {
    const body = await req.json();
    instance_id = body.instance_id;
    organization_id = body.organization_id;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: corsHeaders });
  }

  if (!instance_id || !organization_id) {
    return new Response(JSON.stringify({ error: 'Missing instance_id or organization_id' }), { status: 400, headers: corsHeaders });
  }

  console.log(`🔄 Iniciando sync de contatos para instance: ${instance_id}`);

  try {
    // 1. Configuração da Evolution API (Via Variáveis de Ambiente ou Default)
    const evolutionUrlBase = Deno.env.get('EVOLUTION_API_URL') || 'https://evolution.gamacreativedesign.com.br';
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || '429683C4C977415CAAFCCE10F7D57E11';

    // 2. Buscar contatos da Evolution API
    // Endpoint V2: /chat/findContacts/:instance
    const evolutionUrl = `${evolutionUrlBase}/chat/findContacts/${instance_id}`;

    console.log(`Fetching from: ${evolutionUrl}`);

    const response = await fetch(evolutionUrl, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }



    let data;
    try {
      console.log("⬇️ Baixando JSON da Evolution...");
      const validRes = await response.text();
      console.log(`📦 Payload size: ${validRes.length} chars`);
      data = JSON.parse(validRes);
    } catch (parseError) {
      console.error("❌ Erro ao parsear JSON:", parseError);
      throw new Error("Falha ao processar resposta da Evolution (JSON inválido ou muito grande)");
    }

    // 3. Parsear resposta
    let contacts: EvolutionContact[] = [];

    if (Array.isArray(data)) {
      contacts = data;
    } else if (data.contacts && Array.isArray(data.contacts)) {
      contacts = data.contacts;
    } else if (data.data?.contacts && Array.isArray(data.data.contacts)) {
      contacts = data.data.contacts;
    }

    console.log(`📞 Encontrados ${contacts.length} contatos brutos. Filtrando...`);

    // 4. Filtrar e Preparar
    const validContacts = contacts.filter(c =>
      c.id && c.id.includes('@s.whatsapp.net') && !c.id.includes('@g.us')
    );

    console.log(`✅ ${validContacts.length} contatos válidos (mobile). Preparando para insert...`);

    if (validContacts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum contato válido encontrado para importar.' }), { headers: corsHeaders });
    }

    const contactsToInsert = validContacts.map(c => {
      // Robust ID Detection
      let whatsappId = c.id; // Already filtered above

      const phoneRaw = whatsappId.split('@')[0];
      const cleanPhone = sanitizePhone(phoneRaw);
      const name = c.pushName || c.name || c.verifiedName || `Contato ${cleanPhone.slice(-4)}`;
      const avatar = c.profilePicUrl || c.image || c.picture;

      return {
        organization_id,
        phone: cleanPhone,
        name: name,
        avatar_url: avatar,
        source: 'whatsapp_import',
        whatsapp_id: whatsappId,
        imported_at: new Date().toISOString()
      };
    }).filter(c => c !== null); // Removing nulls

    // 5. UPSERT em Lotes (Menor Batch para evitar Timeout de DB)
    const batchSize = 50;
    let totalImported = 0;

    console.log(`🚀 Iniciando Upsert de ${contactsToInsert.length} itens em batches de ${batchSize}...`);

    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
      const batch = contactsToInsert.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from('contacts')
        .upsert(batch, {
          onConflict: 'organization_id,phone',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error(`❌ Erro no batch ${i}:`, upsertError);
      } else {
        totalImported += batch.length;
        if (i % 500 === 0) console.log(`... processados ${totalImported}`);
      }
    }

    // 7. Log de sucesso
    await supabase.from('sync_logs').insert({
      organization_id,
      type: 'contact_import',
      source: 'whatsapp',
      total_found: contacts.length,
      total_imported: totalImported,
      status: 'success'
    });

    // 8. REFRESH MATERIALIZED VIEW
    console.log("🔄 Refreshing Materialized View...");
    await supabase.rpc('refresh_contacts_view');

    console.log(`✅ ${totalImported} contatos importados com sucesso`);

    return new Response(JSON.stringify({
      success: true,
      total: contacts.length,
      imported: totalImported,
      message: `${totalImported} contatos sincronizados`
    }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ Erro na sincronização:', error);

    await supabase.from('sync_logs').insert({
      organization_id,
      type: 'contact_import',
      source: 'whatsapp',
      status: 'failed',
      error_message: error.message
    });

    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
