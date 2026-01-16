
// supabase/functions/_shared/sanitize.ts

// Regex for UUID v4
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizePhone(phone: string): string {
    if (!phone) return "";

    // 1. Remove non-numeric characters
    let clean = phone.replace(/\D/g, '');

    // 2. Handle Brazilian numbers logic (generic heuristic)
    // If length is 10 or 11 (DDD + Num), assume BR and add 55
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }

    // 3. If starts with 0, remove (011...) -> 11...
    if (clean.startsWith('0')) {
        clean = clean.substring(1);
    }

    // 4. If looks like BR DDI (55) but missing, logic above covers it.
    // Ensure it doesn't just keep growing if run multiple times? 
    // This logic assumes raw input. Checks usually help.

    return clean;
}

export function sanitizeMessage(content: string): string {
    if (!content) return "";

    // 1. Trim
    let clean = content.trim();

    // 2. Remove HTML Tags (Naive but effective for text-only requirements)
    clean = clean.replace(/<[^>]*>/g, '');

    // 3. Limit Length (10k chars)
    if (clean.length > 10000) {
        clean = clean.substring(0, 10000);
    }

    return clean;
}

export function sanitizeJSON(payload: unknown): object | null {
    if (!payload || typeof payload !== 'object') return null;

    try {
        // Deep clone to break references and strip undefined/functions
        const str = JSON.stringify(payload);
        const obj = JSON.parse(str);

        // Sanitize Keys Recursively to remove Prototype Pollution vectors
        return cleanObjectKeys(obj);
    } catch (e) {
        return null;
    }
}

function cleanObjectKeys(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(cleanObjectKeys);
    } else if (obj !== null && typeof obj === 'object') {
        const clean: any = {};
        for (const [key, val] of Object.entries(obj)) {
            // BLOCK DANGEROUS KEYS
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }
            clean[key] = cleanObjectKeys(val);
        }
        return clean;
    }
    return obj;
}

export function validateOrganizationId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;

    // Prevent SQL Injection chars specifically (though validation usually covers this)
    if (id.includes(';') || id.includes(' ') || id.includes('--') || id.includes("'")) return false;

    // Validate UUID format
    return UUID_REGEX.test(id);
}
