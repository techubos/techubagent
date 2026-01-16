
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Workflow, BaseNode, ConditionNode, SendMessageNode, AIGenerateNode } from "./workflow-types.ts";

// Helper for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class WorkflowExecutor {
    private workflow: Workflow;
    private executionId: string;
    private supabase: SupabaseClient;
    private context: any;
    private visitedNodes: Set<string> = new Set();

    constructor(
        workflow: Workflow,
        executionId: string,
        supabase: SupabaseClient,
        context: any
    ) {
        this.workflow = workflow;
        this.executionId = executionId;
        this.supabase = supabase;
        this.context = context; // Contains contact, trigger data, variables
    }

    async execute(startNodeId?: string) {
        try {
            let currentNodeId = startNodeId;

            if (!currentNodeId) {
                // Find Trigger Node
                const triggerNode = this.workflow.nodes.find(n => n.type === 'trigger');
                if (!triggerNode) throw new Error('No trigger node found');
                currentNodeId = triggerNode.id;
            }

            await this.executeNode(currentNodeId);

            // Update status to completed
            await this.updateExecutionStatus('completed');

        } catch (error: any) {
            console.error('Workflow execution failed:', error);
            await this.updateExecutionStatus('failed', error.message);
        }
    }

    private async executeNode(nodeId: string): Promise<void> {
        const node = this.workflow.nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (this.visitedNodes.has(nodeId)) {
            // Prevent infinite loops for now (unless loop node explicitly handled)
            if (node.type !== 'control_loop') {
                console.warn(`Loop detected at node ${nodeId}, stopping safely.`);
                return;
            }
        }
        this.visitedNodes.add(nodeId);

        console.log(`[Workflow] Executing node: ${nodeId} (${node.type})`);

        // Log Execution Step
        await this.logStep(node.id, node.type, 'running');

        let nextNodeId: string | null = null;
        let result: any = {};

        try {
            switch (node.type) {
                case 'trigger':
                    // Just pass through
                    break;

                case 'condition':
                    const conditionResult = await this.evaluateCondition(node as ConditionNode);
                    nextNodeId = conditionResult ? this.getEdgeTarget(nodeId, 'true') : this.getEdgeTarget(nodeId, 'false');
                    if (!nextNodeId) nextNodeId = this.getEdgeTarget(nodeId); // Fallback
                    result = { passed: conditionResult };
                    break;

                case 'send_message':
                    await this.executeSendMessage(node as SendMessageNode);
                    break;

                case 'control_delay':
                    const delayMs = (node.data.delay || 0) * 1000;
                    await sleep(delayMs);
                    break;

                // Add other types here...
            }

            // If nextNodeId not set by special logic (like condition), use default edge
            if (!nextNodeId) {
                nextNodeId = this.getDefaultEdgeTarget(nodeId);
            }

            // Save step success
            await this.logStep(node.id, node.type, 'completed', result);

            // Recursion
            if (nextNodeId) {
                await this.executeNode(nextNodeId);
            }

        } catch (e: any) {
            await this.logStep(node.id, node.type, 'failed', { error: e.message });
            throw e;
        }
    }

    private async evaluateCondition(node: ConditionNode): Promise<boolean> {
        const { conditions, logic } = node.data;
        if (!conditions || conditions.length === 0) return true;

        const results = conditions.map(cond => {
            const val = this.resolveValue(cond.field);
            const compare = cond.value;

            switch (cond.operator) {
                case 'equals': return val == compare;
                case 'contains': return String(val).toLowerCase().includes(String(compare).toLowerCase());
                // Add others
                default: return false;
            }
        });

        return logic === 'OR' ? results.some(r => r) : results.every(r => r);
    }

    private async executeSendMessage(node: SendMessageNode) {
        // Stub for sending message via Evolution API
        // In real implementation, this would call fetch() to Evolution
        console.log(`[Mock] Sending Message: ${node.data.message} to ${this.context.contact.phone}`);
    }

    private getDefaultEdgeTarget(sourceId: string): string | null {
        const edge = this.workflow.edges.find(e => e.source === sourceId);
        return edge?.target || null;
    }

    private getEdgeTarget(sourceId: string, handleId?: string): string | null {
        const edge = this.workflow.edges.find(e => e.source === sourceId && (handleId ? e.sourceHandle === handleId : true));
        return edge?.target || null;
    }

    private resolveValue(path: string): any {
        // Basic resolution: contact.name, trigger.content
        const parts = path.split('.');
        let current = this.context;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    }

    private async updateExecutionStatus(status: string, error?: string) {
        await this.supabase.from('workflow_executions').update({
            status,
            error_message: error,
            completed_at: new Date().toISOString()
        }).eq('id', this.executionId);
    }

    private async logStep(nodeId: string, type: string, status: string, output?: any) {
        // Retrieve current execution path, append, and update (atomic update ideal, but standard update ok for MVP)
        // For performance, maybe only update at end, but real-time logs are better
        console.log(`Step ${nodeId} ${status}`);
    }
}
