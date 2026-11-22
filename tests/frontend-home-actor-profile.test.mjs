/* eslint-disable import/namespace -- Node contract suite tests TSX source. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const displaySource = source.slice(source.indexOf('  const initial = (actorProfile?.display_name'));

test("My Wall never uses an unowned cached profile in display or sharing", () => {
  assert.match(source, /const actorProfile = userId && profile\?\.id === userId \? profile : null/);
  assert.ok(displaySource.startsWith('  const initial = (actorProfile?.display_name'));
  assert.doesNotMatch(displaySource, /\bprofile\?\./, "raw cached profile must not reach display code");
  assert.match(displaySource, /avatar_url \? /);
  assert.match(displaySource, /shareMyWall\(actorProfile\?\.handle\)/);
  assert.match(displaySource, /inviteFriends\(actorProfile\?\.handle\)/);
  assert.match(displaySource, /disabled={!actorProfile\?\.handle}/);
  assert.match(displaySource, /<InviteCrew handle={actorProfile\?\.handle}/);
  assert.match(displaySource, /wallHandle={actorProfile\?\.handle}/);
});

test("previous account personal Wall is hidden before focus-effect clears state", () => {
  assert.match(displaySource, /if \(wall && wall\.owner_id !== userId\) return <Screen><ActivityIndicator/);
  const visible = (actor, profile, wall) => ({
    profile: actor && profile?.id === actor ? profile : null,
    wall: !wall || wall.owner_id === actor ? wall : null,
  });
  assert.deepEqual(visible("b", { id: "a", handle: "private-a" }, { id: "a", name: "A's Wall" }), { profile: null, wall: null });
  assert.equal(visible("b", { id: "b", handle: "b" }, { id: "b", name: "B's Wall" }).profile?.handle, "b");
  assert.equal(visible(null, { id: "a", handle: "private-a" }, { id: "a" }).profile, null);
});
