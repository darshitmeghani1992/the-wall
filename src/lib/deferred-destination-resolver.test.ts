import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { resolveDeferredDestination, type DeferredResolverOperations } from "./deferred-destination-resolver.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const WALL = "33333333-3333-4333-8333-333333333333";
const MARK = "44444444-4444-4444-8444-444444444444";

function operations(overrides: Partial<DeferredResolverOperations> = {}): DeferredResolverOperations {
  return {
    profileByHandle: async () => ({ id: B }),
    personalWall: async () => ({ id: WALL }),
    sharedWall: async () => ({ id: WALL }),
    invitation: async () => ({ status: "available" }),
    wallMark: async () => ({ id: MARK }),
    ...overrides,
  };
}

async function main() {

const calls: string[] = [];
const liveBoundary = operations({
  profileByHandle: async (handle) => { calls.push(`profile:${handle}`); return { id: B }; },
  personalWall: async (ownerId) => { calls.push(`personal:${ownerId}`); return { id: WALL }; },
  sharedWall: async (wallId) => { calls.push(`shared:${wallId}`); return { id: WALL }; },
  invitation: async (wallId) => { calls.push(`invite:${wallId}`); return { status: "available" }; },
  wallMark: async (wallId, markId) => { calls.push(`mark:${wallId}:${markId}`); return { id: MARK }; },
});

await resolveDeferredDestination({ kind: "personal_handle", handle: "maya" }, A, liveBoundary);
await resolveDeferredDestination({ kind: "personal_user", userId: B }, A, liveBoundary);
await resolveDeferredDestination({ kind: "shared_wall", wallId: WALL }, A, liveBoundary);
await resolveDeferredDestination({ kind: "shared_invite", wallId: WALL }, A, liveBoundary);
await resolveDeferredDestination({ kind: "mark", markId: MARK, container: { kind: "personal", ownerId: B } }, A, liveBoundary);
await resolveDeferredDestination({ kind: "mark", markId: MARK, container: { kind: "shared", wallId: WALL } }, A, liveBoundary);
assert.deepEqual(calls, [
  "profile:maya",
  `personal:${B}`,
  `shared:${WALL}`,
  `invite:${WALL}`,
  `personal:${B}`,
  `mark:${WALL}:${MARK}`,
  `shared:${WALL}`,
  `mark:${WALL}:${MARK}`,
], "each live destination family crosses the injected classifier operation boundary");

assert.equal((await resolveDeferredDestination({ kind: "personal_handle", handle: "maya" }, A, operations())).status, "available");
assert.equal((await resolveDeferredDestination({ kind: "personal_user", userId: B }, A, operations())).status, "available");
assert.equal((await resolveDeferredDestination({ kind: "shared_wall", wallId: WALL }, A, operations())).status, "available");
assert.equal((await resolveDeferredDestination({ kind: "shared_invite", wallId: WALL }, A, operations())).status, "available");
assert.equal((await resolveDeferredDestination({ kind: "mark", markId: MARK, container: { kind: "shared", wallId: WALL } }, A, operations())).status, "available");

assert.equal((await resolveDeferredDestination({ kind: "personal_handle", handle: "maya" }, A, operations({ profileByHandle: async () => null }))).status, "terminal_unavailable");
assert.equal((await resolveDeferredDestination({ kind: "personal_user", userId: B }, A, operations({ personalWall: async () => null }))).status, "terminal_unavailable");
assert.equal((await resolveDeferredDestination({ kind: "shared_wall", wallId: WALL }, A, operations({ sharedWall: async () => null }))).status, "terminal_unavailable");
assert.equal((await resolveDeferredDestination({ kind: "shared_invite", wallId: WALL }, A, operations({ invitation: async () => ({ status: "unavailable" }) }))).status, "terminal_unavailable");
assert.equal((await resolveDeferredDestination({ kind: "mark", markId: MARK, container: { kind: "personal", ownerId: B } }, A, operations({ wallMark: async () => null }))).status, "terminal_unavailable");

for (const throwing of [
  { kind: "personal_handle", handle: "maya" } as const,
  { kind: "personal_user", userId: B } as const,
  { kind: "shared_wall", wallId: WALL } as const,
  { kind: "shared_invite", wallId: WALL } as const,
  { kind: "mark", markId: MARK, container: { kind: "shared", wallId: WALL } } as const,
]) {
  const failed = operations({
    profileByHandle: async () => { throw new Error("offline"); },
    personalWall: async () => { throw new Error("offline"); },
    sharedWall: async () => { throw new Error("offline"); },
    invitation: async () => { throw new Error("offline"); },
    wallMark: async () => { throw new Error("offline"); },
  });
  assert.equal((await resolveDeferredDestination(throwing, A, failed)).status, "retryable_failure");
}

console.log("deferred destination resolver: terminal absence and retryable failure boundaries passed");
}

void main();
