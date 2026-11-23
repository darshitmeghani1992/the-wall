import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { resolveComposerTarget } from "./composer-scope.ts";

const shared = { id: "shared-wall", type: "shared", allow_anonymous: true } as const;
const personal = { id: "personal-wall", type: "personal", allow_anonymous: false } as const;
const neverLookUp = () => { assert.fail("Unexpected Wall lookup"); };

test("a transient lookup can retry the same target instead of dropping the current Wall", async () => {
  const target = { sharedWallId: shared.id };
  const requests: string[] = [];
  const lookup = async (id: string) => {
    requests.push(id);
    if (requests.length === 1) throw new Error("network unavailable");
    return shared;
  };

  assert.equal((await resolveComposerTarget("writer", target, lookup, neverLookUp)).status, "retryable");
  assert.deepEqual(await resolveComposerTarget("writer", target, lookup, neverLookUp), { status: "ready", wall: shared });
  assert.deepEqual(requests, [shared.id, shared.id]);
});

test("only the exact Shared or Personal Wall can become a composer target", async () => {
  assert.equal((await resolveComposerTarget("writer", { sharedWallId: "other" }, async () => shared, neverLookUp)).status, "unavailable");
  assert.equal((await resolveComposerTarget("writer", { sharedWallId: shared.id }, async () => personal, neverLookUp)).status, "unavailable");
  assert.equal((await resolveComposerTarget("writer", { recipientId: "friend", wallId: personal.id }, neverLookUp, async () => null)).status, "unavailable");
  assert.deepEqual(await resolveComposerTarget("writer", { recipientId: "friend", wallId: personal.id }, neverLookUp, async () => personal), { status: "ready", wall: personal });
});

test("missing identity and posting to one's own Personal Wall do not query a target", async () => {
  assert.equal((await resolveComposerTarget(null, { sharedWallId: shared.id }, neverLookUp, neverLookUp)).status, "unavailable");
  assert.equal((await resolveComposerTarget("writer", { recipientId: "writer", wallId: personal.id }, neverLookUp, neverLookUp)).status, "unavailable");
});
