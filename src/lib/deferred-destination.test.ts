import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { DeferredDestinationCoordinator, type DeferredStorage } from "./deferred-destination.ts";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { DEFERRED_DESTINATION_STORAGE_KEY, type DeferredNavigationRef } from "./deferred-destination-contract.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const WALL = "33333333-3333-4333-8333-333333333333";

class MemoryStorage implements DeferredStorage {
  value: string | null = null;
  failGet = false;
  failSet = false;
  failRemove = false;
  async getItem(key: string) { assert.equal(key, DEFERRED_DESTINATION_STORAGE_KEY); if (this.failGet) throw new Error("get"); return this.value; }
  async setItem(key: string, value: string) { assert.equal(key, DEFERRED_DESTINATION_STORAGE_KEY); if (this.failSet) throw new Error("set"); this.value = value; }
  async removeItem(key: string) { assert.equal(key, DEFERRED_DESTINATION_STORAGE_KEY); if (this.failRemove) throw new Error("remove"); this.value = null; }
}

function coordinator(storage: MemoryStorage, now = 1_000) {
  let sequence = 0;
  return new DeferredDestinationCoordinator(storage, () => now, () => `opaque${++sequence}`);
}

async function main() {

{
  const storage = new MemoryStorage();
  const first = coordinator(storage);
  assert.equal(await first.capture(`thewall://shared/${WALL}`, { status: "signed_out" }), "captured");
  const restarted = coordinator(storage);
  await restarted.reconcile({ status: "signed_out" }, { status: "authenticated", userId: A });
  const prepared = await restarted.prepare(A);
  assert.equal(prepared.status, "navigate");
  assert.equal((await restarted.prepare(A)).status, "in_flight", "duplicate bootstrap cannot navigate twice");
  if (prepared.status !== "navigate") throw new Error("unreachable");
  const token = restarted.claimReference(prepared.navigationRef, { kind: "shared", wallId: WALL, focusMarkId: null }, A);
  assert.ok(token);
  assert.notEqual(storage.value, null, "claim/read is not consumption");
  assert.equal(await restarted.acknowledgeArrival(token!), true);
  assert.equal(storage.value, null, "terminal render acknowledgement consumes exact snapshot");
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  const prepared = await owner.prepare(A);
  assert.equal(prepared.status, "navigate");
  if (prepared.status !== "navigate") throw new Error("unreachable");
  const staleToken = owner.claimReference(prepared.navigationRef, { kind: "shared", wallId: WALL, focusMarkId: null }, A)!;
  await owner.capture(`thewall://person/${B}`, { status: "authenticated", userId: A }, 1_001);
  assert.equal(await owner.acknowledgeArrival(staleToken), false, "stale token cannot clear replacement");
  assert.equal(owner.transferToUnavailable(staleToken), null);
  assert.notEqual(storage.value, null);
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  await owner.reconcile({ status: "authenticated", userId: A }, { status: "signed_out" });
  await owner.reconcile({ status: "signed_out" }, { status: "authenticated", userId: A });
  assert.equal((await owner.prepare(A)).status, "navigate", "automatic expiry and same-account reauth preserve");
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  await owner.reconcile({ status: "authenticated", userId: A }, { status: "authenticated", userId: B });
  assert.equal(storage.value, null, "A to B purges before B exposure");
  assert.equal((await owner.prepare(B)).status, "none");
}

{
  const storage = new MemoryStorage();
  storage.value = JSON.stringify({
    version: 1,
    capturedAtMs: 0,
    boundSubject: A,
    destination: { kind: "shared_wall", wallId: WALL },
  });
  const other = coordinator(storage, 86_400_001);
  assert.equal((await other.prepare(B)).status, "none", "even an expired A record cannot navigate B");
  assert.equal(storage.value, null);
}

{
  const storage = new MemoryStorage();
  storage.value = "malformed";
  const restarted = coordinator(storage);
  await restarted.reconcile({ status: "unknown" }, { status: "authenticated", userId: A });
  const result = await restarted.prepare(A);
  assert.equal(result.status, "terminal_unavailable", "malformed startup state reaches privacy-safe terminal UI");
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture("thewall://u/maya", { status: "authenticated", userId: A });
  const prepared = await owner.prepare(A);
  if (prepared.status !== "navigate") throw new Error("unreachable");
  const token = owner.claimReference(prepared.navigationRef, { kind: "handle", handle: "maya" }, A)!;
  const transferred = owner.transferHandleTarget(token, { kind: "personal", ownerId: B, focusMarkId: null });
  assert.ok(transferred?.href.includes("__deferred_ref="));
  assert.equal(owner.claimReference(prepared.navigationRef, { kind: "handle", handle: "maya" }, A), null, "reference is one-use");
  assert.ok(owner.claimReference(transferred!.navigationRef, { kind: "personal", ownerId: B, focusMarkId: null }, A));
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  const first = await owner.prepare(A);
  if (first.status !== "navigate") throw new Error("unreachable");
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A }, 1_001);
  const second = await owner.prepare(A, 1_001);
  if (second.status !== "navigate") throw new Error("unreachable");
  const identity = { kind: "shared" as const, wallId: WALL, focusMarkId: null };
  assert.equal(owner.claimReference(first.navigationRef, identity, A), null, "same-route replacement invalidates reference A");
  assert.ok(owner.claimReference(second.navigationRef, identity, A), "same-route replacement reference B remains claimable");
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture("thewall://u/maya", { status: "authenticated", userId: A });
  const prepared = await owner.prepare(A);
  if (prepared.status !== "navigate") throw new Error("unreachable");
  const token = owner.claimReference(prepared.navigationRef, { kind: "handle", handle: "maya" }, A)!;
  const finalTarget = owner.transferHandleTarget(token, { kind: "personal", ownerId: B, focusMarkId: null })!;
  await owner.capture("thewall://u/maya", { status: "authenticated", userId: A }, 1_001);
  assert.equal(owner.claimReference(finalTarget.navigationRef, { kind: "personal", ownerId: B, focusMarkId: null }, A), null, "stale handle transfer cannot claim replacement");
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  const prepared = await owner.prepare(A);
  if (prepared.status !== "navigate") throw new Error("unreachable");
  const token = owner.claimReference(prepared.navigationRef, { kind: "shared", wallId: WALL, focusMarkId: null }, A)!;
  const unavailable = owner.transferToUnavailable(token)!;
  await owner.capture(`thewall://person/${B}`, { status: "authenticated", userId: A }, 1_001);
  assert.equal(owner.claimReference(unavailable.navigationRef, { kind: "unavailable" }, A), null, "stale unavailable UI cannot claim replacement");
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  const prepared = await owner.prepare(A);
  if (prepared.status !== "navigate") throw new Error("unreachable");
  assert.equal(owner.claimReference("external" as DeferredNavigationRef, { kind: "shared", wallId: WALL, focusMarkId: null }, A), null);
  const token = owner.claimReference(prepared.navigationRef, { kind: "shared", wallId: WALL, focusMarkId: null }, A)!;
  assert.equal(await owner.retry(token), true, "retryable resolver failure preserves attempt");
  assert.notEqual(storage.value, null);
}

for (const failure of ["get", "set", "remove"] as const) {
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  if (failure === "set") storage.failSet = true;
  assert.equal(await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A }), failure === "set" ? "rejected" : "captured");
  if (failure === "get") storage.failGet = true;
  if (failure === "remove") {
    storage.failRemove = true;
    await owner.reconcile({ status: "authenticated", userId: A }, { status: "authenticated", userId: B });
  } else await owner.prepare(A);
  assert.equal((await owner.prepare(A)).status, "durable_disabled", `${failure} uncertainty quarantines process`);
}

{
  const storage = new MemoryStorage();
  const owner = coordinator(storage);
  await owner.capture(`thewall://shared/${WALL}`, { status: "authenticated", userId: A });
  storage.failRemove = true;
  await owner.clearForExplicitSignOut();
  await owner.retryExplicitSignOutScrub();
  assert.equal((await owner.prepare(A)).status, "durable_disabled", "sign-out proceeds while recovery remains quarantined");
  storage.failRemove = false;
  const restarted = coordinator(storage);
  await restarted.reconcile({ status: "signed_out" }, { status: "authenticated", userId: B });
  assert.equal((await restarted.prepare(B)).status, "none", "readable stale A record is purged for B after restart");
}

console.log("deferred destination coordinator: lifecycle, isolation, dedupe, token, and quarantine boundaries passed");
}

void main();
