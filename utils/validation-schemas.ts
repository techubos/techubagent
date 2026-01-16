
import { z } from 'zod';
import { sanitizeMessage, sanitizePhone } from './sanitize';

export const ContactSchema = z.object({
    name: z.string().trim().min(3, "Nome muito curto").max(100).optional(),
    phone: z.string().transform(sanitizePhone).refine(val => val.length >= 10, "Telefone inválido"),
    organization_id: z.string().uuid()
});

export const MessageSchema = z.object({
    content: z.string().transform(sanitizeMessage).pipe(z.string().min(1, "Mensagem vazia").max(10000)),
    contact_id: z.string().uuid(),
    organization_id: z.string().uuid()
});
