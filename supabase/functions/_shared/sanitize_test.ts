
// supabase/functions/_shared/sanitize_test.ts
import { assertEquals, assert } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { sanitizePhone, sanitizeMessage, sanitizeJSON, validateOrganizationId } from "./sanitize.ts";
import { MessageSchema } from "./validation-schemas.ts";

Deno.test("sanitizePhone - Formats BR numbers", () => {
    assertEquals(sanitizePhone("11999998888"), "5511999998888");
    assertEquals(sanitizePhone("(11) 99999-8888"), "5511999998888");
    assertEquals(sanitizePhone("5511999998888"), "5511999998888");
    assertEquals(sanitizePhone("+55 11 99999 8888"), "5511999998888");
});

Deno.test("sanitizeMessage - Removes HTML", () => {
    const malicious = "Hello <script>alert('xss')</script><b>World</b>";
    const clean = sanitizeMessage(malicious);
    assertEquals(clean, "Hello alert('xss')World"); // Simple regex strip
});

Deno.test("sanitizeJSON - Blocks Prototype Pollution", () => {
    const malicious = `{"a": 1, "__proto__": {"isAdmin": true}}`;
    const payload = JSON.parse(malicious);
    const clean: any = sanitizeJSON(payload);

    assertEquals(clean.a, 1);
    assertEquals(clean.__proto__, undefined);
    assert(!clean.isAdmin);
});

Deno.test("validateOrganizationId - Checks UUID", () => {
    assert(validateOrganizationId("923a8412-d1d3-4131-8d1b-b5a429c5ee8b"), "Valid UUID");
    assert(!validateOrganizationId("invalid-uuid"), "Invalid string");
    assert(!validateOrganizationId("923a8412-d1d3-4131-8d1b-b5a429c5ee8b'; DROP TABLE"), "SQL Injection attempt");
});

Deno.test("Zod Schema - Message Sanitization Integration", () => {
    const input = {
        content: "  <p>Trim me</p>  ",
        organization_id: "923a8412-d1d3-4131-8d1b-b5a429c5ee8b"
    };

    const parsed = MessageSchema.parse(input);
    assertEquals(parsed.content, "Trim me");
});
