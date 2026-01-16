
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[MaintenanceNotifier] Starting...`);

    // Fetch the latest report
    const { data: report, error: fetchError } = await supabase
        .from('cleanup_reports')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !report) {
        console.error(`[MaintenanceNotifier] Error fetching report:`, fetchError);
        return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404 });
    }

    const summary = `
    🛡️ Relatório Mensal de Manutenção - TecHub Agent
    
    Data: ${new Date(report.executed_at).toLocaleDateString()}
    
    📊 Resultados:
    - Logs deletados: ${report.logs_deleted || 0}
    - Webhooks removidos: ${report.webhooks_deleted || 0}
    - Jobs processados e limpos: ${report.jobs_deleted || 0}
    - Mensagens arquivadas: ${report.messages_archived || 0}
    
    💾 Espaço recuperado (estimado): ${report.space_freed_mb || 0} MB
    
    Sistema operando com performance otimizada.
  `;

    console.log(summary);

    if (resendApiKey) {
        // Implement Resend logic if key is present
        try {
            const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendApiKey}`
                },
                body: JSON.stringify({
                    from: 'TecHub Maintenance <onboarding@resend.dev>',
                    to: ['gusta@gustavodias.com'], // Placeholder or get from settings
                    subject: '📊 Relatório de Manutenção TecHub',
                    text: summary
                })
            });
            console.log(`[MaintenanceNotifier] Email sent. Status: ${resp.status}`);
        } catch (e) {
            console.error(`[MaintenanceNotifier] Error sending email:`, e);
        }
    } else {
        console.warn(`[MaintenanceNotifier] RESEND_API_KEY not found. Summary logged to console only.`);
    }

    return new Response(JSON.stringify({ success: true, summary }), { headers: { 'Content-Type': 'application/json' } });
});
