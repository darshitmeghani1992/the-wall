import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/profile-edit.tsx", import.meta.url), "utf8");

test("Profile editor hides old-account form fields, avatar, username and links before focus reset", () => {
  assert.match(source, /const currentActorLoaded = actorId !== null && profile\?\.id === actorId && loadedActorId === actorId/);
  assert.match(source, /!currentActorLoaded \? \(\s*<ActivityIndicator accessibilityLabel="Loading profile"/);
  assert.match(source, /profileForActor = actorId && profile\?\.id === actorId \? profile : null/);
  assert.match(source, /setLoadedActorId\(null\);\s+setName\(profileForActor\?\.display_name/);
  assert.match(source, /setLoadedActorId\(profileForActor \? actorId : null\)/);
  assert.match(source, /setLoadedActorId\(null\);\s+\};\s+\}, \[actorId, profile\]\)/);
  const formVisible = (actor, profileId, loaded) => actor !== null && actor === profileId && actor === loaded;
  assert.equal(formVisible("A", "A", "A"), true);
  assert.equal(formVisible("B", "A", "A"), false);
  assert.equal(formVisible("B", "A", "B"), false);
  assert.equal(formVisible(null, "A", "A"), false);
});

test("old session event handlers cannot pick, upload or save as a prior actor", () => {
  assert.match(source, /const canSave = currentActorLoaded && !busy && !nameEmpty && !bioOver/);
  assert.equal((source.match(/if \(!currentActorLoaded \|\| !actorId \|\| currentActorId\.current !== actorId\) return;/g) ?? []).length, 2);
  assert.match(source, /const token = actionFence\.current\.begin\(actorId\)/);
  assert.match(source, /if \(!actionFence\.current\.isCurrent\(token, currentActorId\.current\) \|\| res\.canceled\) return/);
  assert.match(source, /if \(!actionFence\.current\.isCurrent\(token, currentActorId\.current\)\) return/);
  assert.match(source, /await updateProfile\(token\.userId/);
});
