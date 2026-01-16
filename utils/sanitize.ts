
import DOMPurify from 'dompurify';

export function sanitizePhone(phone: string): string {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    if (clean.startsWith('0')) {
        clean = clean.substring(1);
    }
    return clean;
}

export function sanitizeMessage(content: string): string {
    if (!content) return "";

    // 1. Basic length limit
    const truncated = content.substring(0, 10000);

    // 2. XSS Protection using DOMPurify
    // We allow basic formatting if needed, but for now strict text
    return DOMPurify.sanitize(truncated, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function sanitizeJSON(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    try {
        const clean = JSON.parse(JSON.stringify(payload));
        return removeInternalKeys(clean);
    } catch (e) {
        return payload;
    }
}

function removeInternalKeys(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(removeInternalKeys);
    } else if (obj !== null && typeof obj === 'object') {
        const clean: any = {};
        for (const [key, val] of Object.entries(obj)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            clean[key] = removeInternalKeys(val);
        }
        return clean;
    }
    return obj;
}

export function validateOrganizationId(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) && !/[;'\-]/.test(id);
}
