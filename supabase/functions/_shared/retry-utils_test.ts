
// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { retryWithBackoff } from "./retry-utils.ts";

Deno.test("Retry: Should succeed immediately if no error", async () => {
    let callCount = 0;
    const result = await retryWithBackoff(async () => {
        callCount++;
        return "Success";
    }, "Test");

    assertEquals(result, "Success");
    assertEquals(callCount, 1);
});

Deno.test("Retry: Should retry twice then succeed", async () => {
    let callCount = 0;
    const result = await retryWithBackoff(async () => {
        callCount++;
        if (callCount < 3) throw new Error("Fail");
        return "Success";
    }, "Test", { maxAttempts: 5, initialDelayMs: 10, factor: 2 });

    assertEquals(result, "Success");
    assertEquals(callCount, 3);
});

Deno.test("Retry: Should throw after max attempts", async () => {
    let callCount = 0;
    await assertRejects(async () => {
        await retryWithBackoff(async () => {
            callCount++;
            throw new Error("Persistent Fail");
        }, "Test", { maxAttempts: 3, initialDelayMs: 10, factor: 2 });
    });
    assertEquals(callCount, 3);
});
