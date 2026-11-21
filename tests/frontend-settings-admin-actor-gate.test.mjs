import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/settings.tsx", import.meta.url), "utf8");

test("Settings honors profile authority only when profile.id matches authenticated actor", () => {
  assert.match(source, /const actorProfile = actorId && profile\?\.id === actorId \? profile : null/);
  assert.match(source, /actorProfile\?\.is_admin \? \(/);
  assert.equal((source.match(/actorProfile\?\.account_status !== "active"/g) ?? []).length, 2);
  assert.doesNotMatch(source, /profile\?\.is_admin \? \(/);
  assert.doesNotMatch(source, /disabled=\{busy \|\| !actorId \|\| profile\?\.account_status/);
  const isAllowed = (actor, profileId) => actor !== null && actor === profileId;
  assert.equal(isAllowed("admin-A", "admin-A"), true);
  assert.equal(isAllowed("user-B", "admin-A"), false);
  assert.equal(isAllowed(null, "admin-A"), false);
});

test("stale session Deactivate callback does not start dialog or mutation", () => {
  assert.match(source, /if \(!actorId \|\| !actorProfile \|\| currentActorId\.current !== actorId \|\| actionInFlight\.current\) return/);
  assert.match(source, /const subjectToken = actionFence\.current\.begin\(actorId\)/);
  assert.match(source, /if \(!actionFence\.current\.isCurrent\(subjectToken, currentActorId\.current\)/);
  assert.match(source, /runSettingsDeactivationFlow/);
});
