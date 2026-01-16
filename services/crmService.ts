import { supabase } from './supabaseClient';
import { Contact, Message } from '../types';

/**
 * CRM Service - Camada de Blindagem
 * Centraliza todas as operações de dados do CRM para garantir consistência e logs.
 */

export const crmService = {
    /**
     * Obtém o ID da organização do usuário atual com fallback robusto.
     */
    async getOrganizationId(): Promise<string> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // 1. Tenta via Metadados (Mais rápido)
        let orgId = user.user_metadata?.organization_id;

        // 2. Fallback para a tabela de perfis (Mais confiável)
        if (!orgId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();
            orgId = profile?.organization_id;
        }

        if (!orgId) throw new Error("Organização não encontrada para este usuário.");
        return orgId;
    },

    /**
     * Cria um novo contato com validação de organização.
     */
    async createContact(contact: Partial<Contact>) {
        const orgId = await this.getOrganizationId();

        const { data, error } = await supabase
            .from('contacts')
            .insert({
                ...contact,
                organization_id: orgId,
                status: contact.status || 'lead'
            })
            .select()
            .single();

        if (error) {
            console.error("[crmService] Error creating contact:", error);
            throw error;
        }
        return data;
    },

    /**
     * Envia uma mensagem e garante o registro no banco.
     */
    async sendMessage(phone: string, content: string, contactId: string) {
        const orgId = await this.getOrganizationId();

        // 1. Registro local imediato (Otimista)
        const { data: localMsg, error: localErr } = await supabase
            .from('messages')
            .insert({
                contact_id: contactId,
                organization_id: orgId,
                content,
                phone,
                role: 'assistant',
                from_me: true,
                status: 'pending_send'
            })
            .select()
            .single();

        if (localErr) throw localErr;

        // 2. Disparo via Edge Function
        try {
            const { error: invokeErr } = await supabase.functions.invoke('evolution-send-v3', {
                body: { action: 'send_message', phone, content }
            });

            if (invokeErr) {
                await supabase.from('messages').update({ status: 'error' }).eq('id', localMsg.id);
                throw invokeErr;
            }

            await supabase.from('messages').update({ status: 'sent' }).eq('id', localMsg.id);
            return localMsg;
        } catch (e) {
            await supabase.from('messages').update({ status: 'error' }).eq('id', localMsg.id);
            throw e;
        }
    }
};
