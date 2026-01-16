
// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { shouldAiRespond, DEFAULT_CONFIG } from "./ai-decision-engine.ts";

// MOCK SUPABASE CLIENT
const mockSupabase = (overrides: any = {}) => {
    return {
        from: (table: string) => ({
            select: (cols: string) => ({
                eq: (field: string, val: string) => ({
                    eq: (field2: string, val2: string) => ({
                        order: () => ({
                            limit: () => Promise.resolve({ data: overrides.messages || [] })
                        })
                    }),
                    single: () => Promise.resolve({
                        data: overrides.contact || { handling_mode: 'ai' },
                        error: overrides.contactError || null
                    })
                })
            })
        })
    } as any;
};

// TESTS

Deno.test("Should Respond: Standard flow", async () => {
    const supabase = mockSupabase(); // default 'ai' mode, no recent messages
    const result = await shouldAiRespond(supabase, "123", "org1", "Olá!");
    assertEquals(result.shouldRespond, true);
    assertEquals(result.reason, "eligible");
});

Deno.test("Should NOT Respond: User asks for human", async () => {
    const supabase = mockSupabase();
    const result = await shouldAiRespond(supabase, "123", "org1", "Quero falar com humano");
    assertEquals(result.shouldRespond, false);
    assertEquals(result.reason, "user_requested_human");
});

Deno.test("Should NOT Respond: Handling mode is human", async () => {
    const supabase = mockSupabase({ contact: { handling_mode: 'human' } });
    const result = await shouldAiRespond(supabase, "123", "org1", "Olá");
    assertEquals(result.shouldRespond, false);
    assertEquals(result.reason, "handling_mode_is_human");
});

Deno.test("Should NOT Respond: Outside Business Hours", async () => {
    // Config forcing tight window 
    // Testing logic depends on current time, so checking if it fails or passes requires mocking Date.
    // For simplicity, we set business hours to IMPOSSIBLE time (e.g. 25-26h) or empty window

    // Actually, let's just assume we run this test at night logic or mock Intl
    // Workaround: Set business hours to only be active at 25:00
    const config = { ...DEFAULT_CONFIG, businessHours: { enabled: true, startHour: 25, endHour: 26, timezone: 'UTC' } };

    const supabase = mockSupabase();
    const result = await shouldAiRespond(supabase, "123", "org1", "Olá", config);
    assertEquals(result.shouldRespond, false);
    assertEquals(result.reason, "outside_business_hours");
});

Deno.test("Should NOT Respond: Cooldown active", async () => {
    // Last message 10 seconds ago
    const recentMsg = { created_at: new Date(Date.now() - 10000).toISOString(), role: 'assistant' };
    const supabase = mockSupabase({ messages: [recentMsg] });

    // Cooldown is 120s by default
    const result = await shouldAiRespond(supabase, "123", "org1", "Olá");
    assertEquals(result.shouldRespond, false);
    // Reason contains dynamic seconds, check start
    assertEquals(result.reason.startsWith("cooldown_active"), true);
});
