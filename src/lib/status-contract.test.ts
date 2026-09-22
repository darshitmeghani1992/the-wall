import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { normalizeStatusDraft, StatusRemovalGuard, statusCharacterCount } from "./status-contract.ts";

assert.deepEqual(normalizeStatusDraft("   "), {
  body: "",
  characterCount: 0,
  valid: false,
  error: "Write something for your Status.",
});
assert.deepEqual(normalizeStatusDraft("  Tell me your favorite memory.  "), {
  body: "Tell me your favorite memory.",
  characterCount: 29,
  valid: true,
  error: null,
});
assert.equal(normalizeStatusDraft("a".repeat(150)).valid, true);
assert.equal(normalizeStatusDraft("a".repeat(151)).valid, false);
assert.equal(statusCharacterCount("👋🏽"), 2, "Unicode code points match PostgreSQL char_length semantics");

const dirtyGuard = new StatusRemovalGuard();
dirtyGuard.setDirty(true);
assert.equal(dirtyGuard.removalDecision(), "confirm", "dirty hardware back or swipe requires confirmation");
assert.equal(dirtyGuard.shouldPreventRemoval(), true);
dirtyGuard.approveRemoval();
assert.equal(dirtyGuard.removalDecision(), "allow", "explicit discard permits the captured removal action");

async function testDelayedOperations() {
  for (const operation of ["save", "remove"] as const) {
    const busyGuard = new StatusRemovalGuard();
    let resolveOperation!: () => void;
    const delayedOperation = new Promise<void>((resolve) => { resolveOperation = resolve; });
    assert.equal(busyGuard.beginOperation(), true);
    assert.equal(busyGuard.removalDecision(), "block", `${operation} blocks gesture/back while awaiting confirmation`);
    let appearedDiscarded = false;
    if (busyGuard.removalDecision() === "allow") appearedDiscarded = true;
    resolveOperation();
    await delayedOperation;
    assert.equal(appearedDiscarded, false, `${operation} cannot appear discarded before its response`);
    busyGuard.finishOperation();
    busyGuard.approveRemoval();
    assert.equal(busyGuard.removalDecision(), "allow", `confirmed ${operation} permits programmatic close`);
  }
}

void testDelayedOperations().then(() => {
  console.log("Status contract: trim, boundaries, and route-removal guards passed");
}).catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "Status contract test failed");
  process.exitCode = 1;
});
