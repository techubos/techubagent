
// supabase/functions/_shared/validation-schemas.ts
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sanitizeMessage, sanitizePhone } from "./sanitize.ts";

// --- CONTACT SCHEMA ---
export const ContactSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    phone: z.string().transform(sanitizePhone).refine(val => val.length >= 10, { message: "Invalid Phone Number" }),
    organization_id: z.string().uuid()
});

// --- MESSAGE SCHEMA ---
export const MessageSchema = z.object({
    // Transform content to clean HTML
    content: z.string().transform(sanitizeMessage).pipe(z.string().min(1).max(10000)),
    contact_id: z.string().uuid().optional(),
    organization_id: z.string().uuid(),
    timestamp: z.number().int().positive().optional(),
    whatsapp_message_id: z.string().min(1).optional()
});

// --- WEBHOOK PAYLOAD SCHEMA (Evolution API Partial) ---
// We validate only critical fields we map to DB
export const EvolutionPayloadSchema = z.object({
    event: z.string(),
    instance: z.string().min(1),
    data: z.object({
        key: z.object({
            remoteJid: z.string(),
            fromMe: z.boolean(),
            id: z.string()
        }),
        pushName: z.string().optional().nullable(),
        messageTimestamp: z.number().or(z.string()), // Evolution sometimes sends string? handling both
        message: z.any() // Complex object, simple validation here, sanitization later on extraction
    }),
    organization_id: z.string().uuid().optional() // Found via lookup usually, but if passed in payload validation
});

// --- QUEUE ITEM SCHEMA ---
export const QueueItemSchema = z.object({
    payload: z.object({}).passthrough(), // Verify it is a valid object
    organization_id: z.string().uuid()
});
