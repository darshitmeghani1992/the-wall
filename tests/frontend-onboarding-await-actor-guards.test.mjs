/* eslint-disable import/namespace -- Node runner strips TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AccountRouteFence } from "../src/lib/onboarding-contract.ts";

const find = readFileSync(new URL("../app/(onboarding)/find-people.tsx", import.meta.url), "utf8");
const tour = readFileSync(new URL("../app/(onboarding)/walkthrough.tsx", import.meta.url), "utf8");

test("Find People checks current actor after loading draft and before saving", () => {
  assert.match(find, /const draft = await loadOnboardingDraft\(userId\);[\s\S]*?if \(!lifecycleFence\.current\.isCurrent\(token, liveActorId\.current\)\) return;\s*await saveOnboardingDraft/);
});
test("Walkthrough checks current actor after draft read and after local clear, before Auth refresh", () => {
  assert.match(tour, /const draft = await loadOnboardingDraft\(userId\);[\s\S]*?if \(!lifecycleFence\.current\.isCurrent\(token, liveActorId\.current\)\) return;\s*try \{ await clearOnboardingDraft/);
  assert.match(tour, /if \(!lifecycleFence\.current\.isCurrent\(token, liveActorId\.current\)\) return;\s*await refreshAccountRoute\(\)/);
  // After Auth refresh changes the server route to ready, the final check
  // must remain actor/revision-only (not account-route) so the deferred destination is not lost.
  assert.match(tour, /await refreshAccountRoute\(\);\s*if \(isActorRevisionCurrent\(\)\)/);
});

test("an actor switch while a local draft read is pending suppresses the following mutation", async () => {
  const fence = new AccountRouteFence();
  let actor = "A";
  const token = fence.begin("A");
  let resolveRead;
  const read = new Promise((resolve) => { resolveRead = resolve; });
  const writes = [];
  const flow = async () => {
    const draft = await read;
    if (!fence.isCurrent(token, actor)) return;
    writes.push(draft);
  };
  const pending = flow();
  actor = "B";
  fence.invalidate(actor);
  resolveRead({ handle: "A-handle" });
  await pending;
  assert.deepEqual(writes, []);
});
