import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function cleanJSON(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : text;
    } catch (e: unknown) {
        return text;
    }
}

// Types for JSON Workflow
interface WorkflowNode {
    id: string;
    type: string;
    data: {
        label?: string;
        content?: string; // Message content
        variable?: string; // For questions
        actionType?: string; // For actions
        [key: string]: any;
    };
    position: { x: number; y: number };
}

interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const payload = await req.json();
        const { contactId, flowId, currentNodeId: inputNodeId, message: userMessage } = payload;
        const recursionCount = payload.recursionCount || 0;

        if (recursionCount > 10) {
            console.error("Flow Engine: Recursion Limit Exceeded");
            return new Response(JSON.stringify({ error: "Recursion Limit" }), { headers: corsHeaders, status: 400 });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        // if (!openaiKey) throw new Error("OPENAI_API_KEY missing") // Optional if not using AI nodes

        // 1. Fetch JSON Workflow
        // We fetch the whole JSON. For very large flows, this might be heavy, but fine for typical use.
        const { data: workflow, error: flowError } = await supabase
            .from('workflows')
            .select('*')
            .eq('id', flowId)
            .single();

        if (flowError || !workflow) {
            throw new Error(`Fluxo não encontrado: ${flowId}`);
        }

        const nodes: WorkflowNode[] = Array.isArray(workflow.nodes) ? workflow.nodes : [];
        const edges: WorkflowEdge[] = Array.isArray(workflow.edges) ? workflow.edges : [];

        // 2. Determine Current Node
        let node: WorkflowNode | undefined;

        if (!inputNodeId) {
            // Find Start Node based on type 'trigger' or 'start'
            // In our Editor we used 'trigger' or 'start' (data.type = 'start')?
            // Editor uses: type: 'trigger' (for initial) or 'start' in legacy.
            // Let's look for type 'trigger' (green node).
            node = nodes.find(n => n.type === 'trigger' || n.type === 'start');
            if (!node) throw new Error("Fluxo sem nó de INÍCIO (Gatilho).");
        } else {
            node = nodes.find(n => n.id === inputNodeId);
            if (!node) throw new Error(`Nó ${inputNodeId} não encontrado no fluxo.`);
        }

        const nodeId = node.id;
        console.log(`Processing Node: ${node.type} (${nodeId})`);

        let nextNodeId: string | null = null;
        let assistantResponse: string | null = null;

        // Helper: Find outgoing edges
        const getOutgoingEdges = (sourceId: string) => edges.filter(e => e.source === sourceId);

        // --- EXECUTION LOGIC ---

        // CASE: TRIGGER / START
        if (node.type === 'trigger' || node.type === 'start') {
            // Just move next
            const outEdges = getOutgoingEdges(nodeId);
            if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        }

        // CASE: SEND MESSAGE
        else if (node.type === 'message' || node.type === 'send_message') {
            const content = node.data.content || node.data.message || "...";

            // Resolve variables (Simple strict replacement)
            // ex: {{contact.name}}
            let finalContent = content;
            if (content.includes('{{')) {
                const { data: contact } = await supabase.from('contacts').select('*').eq('id', contactId).single();
                if (contact) {
                    finalContent = finalContent.replace(/{{name}}/g, contact.name || '');
                    finalContent = finalContent.replace(/{{phone}}/g, contact.phone || '');
                    // Add more as needed
                }
            }

            console.log(`Sending Message: ${finalContent}`);

            // Insert into messages table
            await supabase.from('messages').insert({
                contact_id: contactId,
                role: 'assistant',
                is_from_me: true,
                content: finalContent,
                type: 'text',
                status: 'pending_send'
            });

            // Trigger Send (Async)
            const { data: contact } = await supabase.from('contacts').select('phone').eq('id', contactId).single();
            if (contact?.phone) {
                await supabase.functions.invoke('evolution-send-v3', {
                    body: { action: 'send_message', phone: contact.phone, content: finalContent }
                });
            }

            assistantResponse = finalContent;

            const outEdges = getOutgoingEdges(nodeId);
            if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        }

        // CASE: QUESTION (Ask & Wait)
        else if (node.type === 'question') {
            const { data: contactState } = await supabase.from('contacts').select('current_node_id').eq('id', contactId).single();

            // If stored state is DIFFERENT from current node, it means we just arrived.
            // We send the question and HALT recursively (wait for user).
            if (contactState?.current_node_id !== nodeId) {
                const content = node.data.content || "Pergunta...";
                console.log(`Asking Question: ${content}`);

                await supabase.from('messages').insert({
                    contact_id: contactId,
                    role: 'assistant',
                    is_from_me: true,
                    content: content,
                    type: 'text',
                    status: 'pending_send'
                });
                const { data: contact } = await supabase.from('contacts').select('phone').eq('id', contactId).single();
                if (contact?.phone) {
                    await supabase.functions.invoke('evolution-send-v3', {
                        body: { action: 'send_message', phone: contact.phone, content: content }
                    });
                }

                // Update state to stay here
                await supabase.from('contacts').update({
                    current_workflow_id: flowId,
                    current_node_id: nodeId
                }).eq('id', contactId);

                return new Response(JSON.stringify({ success: true, status: 'waiting_input' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            else {
                // We are already here, so this request MUST be the user response.
                console.log(`Received Answer for Question Node: ${userMessage}`);

                // Save variable
                const varName = node.data.variable;
                if (varName) {
                    const { data: contact } = await supabase.from('contacts').select('metadata').eq('id', contactId).single();
                    const newMeta = { ...contact?.metadata, [varName]: userMessage };
                    await supabase.from('contacts').update({ metadata: newMeta }).eq('id', contactId);
                }

                // Move Next
                const outEdges = getOutgoingEdges(nodeId);
                if (outEdges.length > 0) nextNodeId = outEdges[0].target;
            }
        }

        // CASE: CONDITION
        else if (node.type === 'condition') {
            // Mock Logic: If message contains "sim" -> True
            const isTrue = userMessage?.toLowerCase().includes('sim') || userMessage?.toLowerCase().includes('yes');

            const handleId = isTrue ? 'true' : 'false';

            // Find edge connecting from this handle
            const matchEdge = edges.find(e => e.source === nodeId && (e.sourceHandle === handleId || e.label?.toLowerCase() === handleId));
            // Fallback: First edge
            const fallbackEdge = edges.find(e => e.source === nodeId);

            nextNodeId = matchEdge?.target || fallbackEdge?.target || null;
            console.log(`Condition (Mock): ${isTrue ? 'True' : 'False'} -> Next: ${nextNodeId}`);
        }

        // CASE: ACTION
        else if (node.type === 'action') {
            const actionType = node.data.actionType;
            console.log(`Executing Action: ${actionType}`);

            if (actionType === 'transfer') {
                await supabase.from('contacts').update({ status: 'open' }).eq('id', contactId);
                await supabase.from('messages').insert({
                    contact_id: contactId,
                    role: 'assistant',
                    is_from_me: true,
                    content: "Transferred to agent.",
                    type: 'action_log'
                });
            }
            // Auto advance
            const outEdges = getOutgoingEdges(nodeId);
            if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        }

        // --- RECURSION / NEXT STEP ---

        if (nextNodeId) {
            console.log(`Moving to Next Node: ${nextNodeId}`);

            // Update State
            await supabase.from('contacts').update({
                current_workflow_id: flowId,
                current_node_id: nextNodeId
            }).eq('id', contactId);

            // Fetch Next Node to check type
            const nextNode = nodes.find(n => n.id === nextNodeId);

            // AUTO-RUN LOGIC
            if (nextNode) {
                // Prevent infinite loop if something is wrong, relying on recursionCount
                await supabase.functions.invoke('flow-engine', {
                    body: {
                        contactId,
                        flowId,
                        currentNodeId: nextNodeId,
                        message: userMessage,
                        recursionCount: recursionCount + 1
                    }
                });
            }
        } else {
            console.log("Flow End.");
            // Clear state
            await supabase.from('contacts').update({
                current_workflow_id: null,
                current_node_id: null
            }).eq('id', contactId);
        }

        return new Response(JSON.stringify({ success: true, nextNodeId, response: assistantResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: unknown) {
        console.error("Flow Engine Error:", error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
