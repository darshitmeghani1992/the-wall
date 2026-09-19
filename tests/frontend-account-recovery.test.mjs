/* eslint-disable import/namespace -- Node loads this TypeScript module directly. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runAccountRecoveryFlow } from "../src/lib/account-recovery-flow.ts";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test("recovery ignores delayed reactivation after an account switch", async () => {
  const pending = deferred();
  const events = [];
  let current = true;
  const flow = runAccountRecoveryFlow({
    expectedActorId: "actor-a",
    isCurrent: () => current,
    reactivate: async (actorId) => {
      events.push(["reactivate", actorId]);
      await pending.promise;
    },
    refreshAccountRoute: async () => events.push(["refresh"]),
    navigateToCanonicalGate: () => events.push(["navigate"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });
  await Promise.resolve();
  current = false;
  pending.resolve();
  await flow;
  assert.deepEqual(events, [["reactivate", "actor-a"]]);
});

test("recovery rechecks its fence after route refresh", async () => {
  const pending = deferred();
  const events = [];
  let current = true;
  const flow = runAccountRecoveryFlow({
    expectedActorId: "actor-a",
    isCurrent: () => current,
    reactivate: async () => events.push(["reactivate"]),
    refreshAccountRoute: async () => {
      events.push(["refresh"]);
      await pending.promise;
    },
    navigateToCanonicalGate: () => events.push(["navigate"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });
  await Promise.resolve();
  current = false;
  pending.resolve();
  await flow;
  assert.deepEqual(events, [["reactivate"], ["refresh"]]);
});

test("recovery refreshes before navigating and releases current UI", async () => {
  const events = [];
  await runAccountRecoveryFlow({
    expectedActorId: "actor-a",
    isCurrent: () => true,
    reactivate: async (actorId) => events.push(["reactivate", actorId]),
    refreshAccountRoute: async () => events.push(["refresh"]),
    navigateToCanonicalGate: () => events.push(["navigate"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });
  assert.deepEqual(events, [
    ["reactivate", "actor-a"],
    ["refresh"],
    ["navigate"],
    ["finally"],
  ]);
});

test("recovery screen keeps lifecycle invalidation separate from route redirects", () => {
  const source = readFileSync("app/account-recovery.tsx", "utf8");
  assert.match(source, /runAccountRecoveryFlow\(\{/);
  assert.match(source, /return \(\) => currentFence\.invalidate\(currentUserId\.current\);\s*\}, \[userId\]\);/);
  assert.match(source, /\}, \[accountRoute, router\]\);/);
  assert.match(source, /isCurrent: \(\) => fence\.current\.isCurrent\(token, currentUserId\.current\)/);
});
