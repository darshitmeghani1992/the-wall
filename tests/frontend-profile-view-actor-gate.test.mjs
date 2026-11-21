import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(tabs)/profile.tsx", import.meta.url), "utf8");

test("Profile public header and links never display a stale previous-session profile", () => {
  assert.match(source, /const actorProfile = actorId && profile\?\.id === actorId \? profile : null/);
  assert.match(source, /const initial = \(actorProfile\?\.display_name\?\.\[0\] \?\? "\?"\)\.toUpperCase\(\)/);
  assert.match(source, /actorProfile\?\.avatar_url \? \(/);
  assert.match(source, /uri: actorProfile\.avatar_url/);
  assert.match(source, /actorProfile\?\.display_name \?\? "You"/);
  assert.match(source, /actorProfile\?\.handle \? <Text/);
  assert.match(source, /actorProfile\?\.bio \? <Text/);
  assert.match(source, /actorProfile \? <SocialLinks profile=\{actorProfile\}/);
  const view = (actor, profileId) => actor !== null && profileId === actor;
  assert.equal(view("A", "A"), true);
  assert.equal(view("B", "A"), false);
  assert.equal(view(null, "A"), false);
});

test("Share and Edit profile cannot use a prior actor's handle or profile", () => {
  assert.match(source, /label="Share my Wall" variant="yellow" disabled=\{!actorProfile\} onPress=\{\(\) => shareMyWall\(actorProfile\?\.handle\)\}/);
  assert.match(source, /label="Edit profile" variant="ghost" disabled=\{!actorProfile\}/);
  assert.doesNotMatch(source, /shareMyWall\(profile\?\.handle\)/);
});
