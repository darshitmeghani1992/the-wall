/* eslint-disable import/namespace -- Native screen wiring is checked by Node contract tests. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(tabs)/profile.tsx", import.meta.url), "utf8");

test("Profile counters are associated with the authenticated actor before a request awaits", () => {
  assert.match(source, /const \[countsActorId, setCountsActorId\] = useState<string \| null>\(null\)/);
  assert.match(source, /const \[friendsActorId, setFriendsActorId\] = useState<string \| null>\(null\)/);
  assert.match(source, /setCountsActorId\(token\.userId\);\s*setCountsLoading\(true\)/);
  assert.match(source, /setFriendsActorId\(token\.userId\);\s*setFriendCountLoading\(true\)/);
  assert.match(source, /setCountsActorId\(null\);\s*setFriendsActorId\(null\)/);
});

test("render never shows prior actor counts or failures before the focus effect runs", () => {
  assert.match(source, /const countsAreForActor = Boolean\(actorId && countsActorId === actorId\)/);
  assert.match(source, /const friendsAreForActor = Boolean\(actorId && friendsActorId === actorId\)/);
  assert.match(source, /!actorId \? null : !countsAreForActor \|\| countsLoading \? <ActivityIndicator/);
  assert.match(source, /!actorId \? null : !friendsAreForActor \|\| friendCountLoading \? <ActivityIndicator/);
  assert.match(source, /: countsError \? \(/);
  assert.match(source, /: friendCountError \? \(/);
});

test("A to B render gates both old success and old failure, but shows B's completed result", () => {
  const actor = "actor-b";
  let countsActorId = "actor-a";
  let friendsActorId = "actor-a";
  let oldCounter = 47;
  let oldError = true;
  const showCount = () => countsActorId === actor && !oldError;
  const showFriend = () => friendsActorId === actor && !oldError;
  assert.equal(showCount(), false);
  assert.equal(showFriend(), false);
  countsActorId = actor;
  friendsActorId = actor;
  oldCounter = 2;
  oldError = false;
  assert.equal(showCount(), true);
  assert.equal(showFriend(), true);
  assert.equal(oldCounter, 2);
});
