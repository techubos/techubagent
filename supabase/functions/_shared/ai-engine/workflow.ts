import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AIContext, AIResponse } from './types.ts';

export async function checkWorkflows(
    supabase: SupabaseClient,
    context: AIContext
): Promise<AIResponse | null> {

    // 1. Check for Active Session
    const { data: session } = await supabase
        .from('ai_workflow_sessions')
        .select('*, ai_workflows(*)')
        .eq('contact_id', context.contactId)
        .eq('status', 'in_progress')
        .single();

    // 2. If valid session, continue
    if (session) {
        return await continueWorkflow(supabase, session, context);
    }

    // 3. If no session, check if any workflow is triggered
    // This is often triggered by rules (action: 'execute_workflow'), but logic could be here too.
    // Ideally, the Rules Engine detects the trigger and RETURNS 'execute_workflow', 
    // which the Orchestrator then uses to START a workflow. 
    // So this function mainly handles "Active" workflows.

    return null;
}

export async function continueWorkflow(
    supabase: SupabaseClient,
    session: any,
    context: AIContext
): Promise<AIResponse> {
    const workflow = session.ai_workflows;
    const steps = workflow.steps; // Array of steps
    const currentStepId = session.current_step;

    const currentStepIndex = steps.findIndex((s: any) => s.id === currentStepId);
    if (currentStepIndex === -1) return { message: "Erro no fluxo.", action: 'transfer_human' };

    const currentStep = steps[currentStepIndex];

    // Validate Input (if needed validation logic exists)
    // Save Input to collected_data
    const newData = { ...session.collected_data, [currentStep.variable]: context.userMessage };

    // Determine Next Step
    const nextStepId = currentStep.next;

    if (!nextStepId) {
        // Workflow Completed
        await supabase
            .from('ai_workflow_sessions')
            .update({
                status: 'completed',
                collected_data: newData,
                completed_at: new Date().toISOString()
            })
            .eq('id', session.id);

        return {
            message: "Obrigado! Recebi todas as informações.",
            action: 'respond'
        };
    }

    // Move to Next Step
    const nextStep = steps.find((s: any) => s.id === nextStepId);

    if (nextStep) {
        await supabase
            .from('ai_workflow_sessions')
            .update({
                current_step: nextStepId,
                collected_data: newData
            })
            .eq('id', session.id);

        return {
            message: nextStep.question,
            action: 'respond'
        };
    }

    return { message: "Fluxo encerrado.", action: 'none' };
}

export async function startWorkflow(
    supabase: SupabaseClient,
    workflowId: string,
    context: AIContext
): Promise<AIResponse> {
    const { data: workflow } = await supabase
        .from('ai_workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        return { message: "Fluxo inválido.", action: 'transfer_human' };
    }

    const firstStep = workflow.steps[0];

    await supabase.from('ai_workflow_sessions').insert({
        contact_id: context.contactId,
        workflow_id: workflowId,
        current_step: firstStep.id,
        status: 'in_progress'
    });

    return {
        message: firstStep.question,
        action: 'respond'
    };
}
