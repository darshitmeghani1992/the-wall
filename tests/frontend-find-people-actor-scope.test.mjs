/* eslint-disable import/namespace -- Node runner strips TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AccountRouteFence, onboardingScreenScopeKey } from "../src/lib/onboarding-contract.ts";

const source = readFileSync(new URL("../app/(onboarding)/find-people.tsx", import.meta.url), "utf8");

test("Find People drafts, busy state and actor-scoped share identity remount on account or route change", () => {
  assert.match(source, /liveActorId\.current = actorId/);
  assert.match(source, /const actorHandle = actorId && profile\?\.id === actorId \? profile\.handle : null/);
  assert.match(source, /key=\{onboardingScreenScopeKey\(actorId, accountRoute\)\}/);
  assert.match(source, /function FindPeopleEditor\(/);
  assert.match(source, /if \(share\) await inviteFriends\(actorHandle\)/);
  assert.notEqual(onboardingScreenScopeKey("A", "walkthrough"), onboardingScreenScopeKey("B", "walkthrough"));
  assert.notEqual(onboardingScreenScopeKey("A", "walkthrough"), onboardingScreenScopeKey("A", "ready"));
});

test("stale share or draft continuation cannot cross an account change before effect cleanup", () => {
  assert.match(source, /userId !== liveActorId\.current \|\| accountRoute !== "walkthrough"/);
  assert.match(source, /if \(!lifecycleFence\.current\.isCurrent\(token, liveActorId\.current\)\) return/);
  const fence = new AccountRouteFence();
  const old = fence.begin("A");
  assert.equal(fence.isCurrent(old, "A"), true);
  // A→B synchronously updates render ref before useEffect cleanup.
  assert.equal(fence.isCurrent(old, "B"), false);
  fence.invalidate("B");
  const now = fence.begin("B");
  assert.equal(fence.isCurrent(old, "A"), false);
  assert.equal(fence.isCurrent(now, "B"), true);
  fence.invalidate(null);
  assert.equal(fence.isCurrent(now, "B"), false);
});

test("Find People shares neutral invite if current actor profile has not loaded", () => {
  assert.match(source, /const actorHandle = actorId && profile\?\.id === actorId \? profile\.handle : null/);
  assert.match(source, /await inviteFriends\(actorHandle\)/);
  // A cached profile from A must not supply a personal deep link under B.
  const resolveHandle = (actor, profile) => actor && profile?.id === actor ? profile.handle : null;
  assert.equal(resolveHandle("B", { id: "A", handle: "private-A" }), null);
  assert.equal(resolveHandle("B", { id: "B", handle: "public-B" }), "public-B");
});

test("Find People claims one continuation before sharing or reading the draft", () => {
  assert.match(source, /const continuationInFlight = useRef\(false\)/);
  const begin = source.indexOf("if (!beginExclusiveMutation(continuationInFlight)) return;");
  assert.ok(begin > 0);
  assert.ok(begin < source.indexOf("if (share) await inviteFriends(actorHandle);"));
  assert.ok(begin < source.indexOf("const draft = await loadOnboardingDraft(userId);"));
  assert.match(source, /finally \{\s*if \(lifecycleFence\.current\.isCurrent\(token, liveActorId\.current\)\) \{\s*endExclusiveMutation\(continuationInFlight\);/);
});
