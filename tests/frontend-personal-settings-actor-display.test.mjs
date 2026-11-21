import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/personal-wall-settings.tsx", import.meta.url), "utf8");

test("Personal Wall settings never render previous account's choices before focus reset", () => {
  assert.match(source, /const currentActorLoaded = actorId !== null && loadedActorId\.current === actorId/);
  assert.match(source, /const visibleSaved = currentActorLoaded \? saved : null/);
  assert.match(source, /const visibleError = currentActorLoaded \? error : null/);
  assert.match(source, /const dirty = currentActorLoaded && personalSettingsChanged\(saved, draft\)/);
  assert.match(source, /\{loading \|\| \(Boolean\(actorId\) && !currentActorLoaded\) \? \(/);
  assert.match(source, /\) : !visibleSaved \? \(/);
  assert.match(source, /\{visibleError \?\? "These settings aren't available\."\}/);
  const visible = (actor, loaded) => actor !== null && actor === loaded;
  assert.equal(visible("A", "A"), true);
  assert.equal(visible("B", "A"), false);
  assert.equal(visible(null, "A"), false);
});

test("load failures and sign-out use account-bound unavailable and retry states", () => {
  assert.match(source, /loadedActorId\.current = token\.userId;\s+setSaved\(null\);\s+setError\(cause/);
  assert.match(source, /if \(!actorId \|\| loadedActorId\.current !== actorId\) \{/);
  assert.match(source, /\{actorId \? <Button label="Try again" variant="yellow" onPress=\{\(\) => void load\(\)\} \/> : null\}/);
  assert.match(source, /setLoading\(true\);\s+setError\(null\);\s+setSaved\(null\);\s+loadedActorId\.current = null;/);
});

test("save cannot apply prior account's draft under a new session", () => {
  assert.match(source, /if \(!actorId \|\| currentActorId\.current !== actorId \|\| !currentActorLoaded \|\| !saved \|\| !dirty/);
  assert.match(source, /const token = actionFence\.current\.begin\(actorId\)/);
  assert.match(source, /await updatePersonalWallSettings\(token\.userId, draft\)/);
  assert.match(source, /actionFence\.current\.isCurrent\(token, currentActorId\.current\)/);
});
