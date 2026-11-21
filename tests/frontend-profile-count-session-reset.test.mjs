/* eslint-disable import/namespace -- Node test runner type-strips TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const screen = readFileSync(new URL("../app/(tabs)/profile.tsx", import.meta.url), "utf8");
const start = screen.indexOf("useFocusEffect(useCallback(() => {");
const end = screen.indexOf("}, [refreshCounts, refreshFriends, session?.user.id]));", start);
assert.ok(start >= 0 && end > start, "Profile focus hook is present");
const effect = screen.slice(start, end);

test("Profile resets both account-specific follower and friendship counters on focus", () => {
  assert.match(effect, /countsFence\.current\.focus\(userId\)/);
  assert.match(effect, /friendFence\.current\.focus\(userId\)/);
  assert.match(effect, /setFollowers\(0\)/);
  assert.match(effect, /setFollowing\(0\)/);
  assert.match(effect, /setFriendCount\(null\)/);
  assert.match(effect, /setCountsError\(false\)/);
  assert.match(effect, /setFriendCountError\(false\)/);
});

test("Profile never starts actor-bound count requests when signed out", () => {
  assert.match(effect, /if \(userId\) \{\s*void refreshCounts\(\);\s*void refreshFriends\(\);\s*\} else \{/);
  assert.match(effect, /else \{[\s\S]*setCountsLoading\(false\)/);
  assert.match(effect, /else \{[\s\S]*setFriendCountLoading\(false\)/);
  assert.match(effect, /return \(\) => \{\s*countsFence\.current\.blur\(\);\s*friendFence\.current\.blur\(\)/);
});

test("account switch invalidates pending old-account count responses", () => {
  const followers = new SessionFocusFence();
  const friends = new SessionFocusFence();
  followers.focus("actor-a");
  friends.focus("actor-a");
  const oldFollowers = followers.begin("actor-a");
  const oldFriends = friends.begin("actor-a");
  assert.ok(oldFollowers && oldFriends);
  followers.blur();
  friends.blur();
  followers.focus("actor-b");
  friends.focus("actor-b");
  assert.equal(followers.isCurrent(oldFollowers, "actor-b"), false);
  assert.equal(friends.isCurrent(oldFriends, "actor-b"), false);
  const newFollowers = followers.begin("actor-b");
  assert.ok(newFollowers);
  assert.equal(followers.isCurrent(newFollowers, "actor-b"), true);
});
