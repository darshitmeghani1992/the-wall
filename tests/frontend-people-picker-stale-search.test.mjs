/* eslint-disable import/namespace -- Node strips TypeScript at test runtime. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/people-picker.tsx", import.meta.url), "utf8");
const focusBody = source.slice(source.indexOf("  useFocusEffect("), source.indexOf("  async function search()"));
const searchBody = source.slice(source.indexOf("  async function search()"), source.indexOf("  async function choosePerson("));
const inputBody = source.slice(source.indexOf("      <Input\n"), source.indexOf("      <Pressable onPress={search}"));

test("picker clears account-specific people/query/errors when focus changes", () => {
  assert.match(focusBody, /loadFence\.current\.focus\(userId \?\? null\)/);
  assert.match(focusBody, /setQuery\(" "\)/);
  assert.match(focusBody, /setPeople\(\[\]\)/);
  assert.match(focusBody, /setError\(null\)/);
  assert.match(focusBody, /loadFence\.current\.blur\(\)/);
});

test("picker pins in-flight search to original trimmed query and actor", () => {
  assert.match(searchBody, /const queryAtStart = query\.trim\(\)/);
  assert.match(searchBody, /const token = loadFence\.current\.begin\(userId \?\? null\)/);
  assert.match(searchBody, /await searchPeople\(token\.userId, queryAtStart\)/);
  assert.match(searchBody, /loadFence\.current\.isCurrent\(token, currentUserId\.current\)/);
  assert.doesNotMatch(searchBody, /searchPeople\(token\.userId, query\)/);
});

test("editing cancels stale results and errors; clearing query reloads own friends", () => {
  assert.match(inputBody, /onChangeText=\{\(value\) => \{/);
  assert.match(inputBody, /loadFence\.current\.focus\(userId \?\? null\)/);
  assert.match(inputBody, /setPeople\(\[\]\)/);
  assert.match(inputBody, /setError\(null\)/);
  assert.match(inputBody, /setLoading\(false\)/);
  assert.match(inputBody, /if \(!value\.trim\(\) && userId\) void loadFriends\(\)/);
});

test("stale friend loads, searches, and errors cannot repaint after query edit or account change", () => {
  const fence = new SessionFocusFence();
  fence.focus("actor-a");
  const initialFriends = fence.begin("actor-a");
  assert.ok(initialFriends);
  fence.focus("actor-a"); // edit while the initial list is loading
  assert.equal(fence.isCurrent(initialFriends, "actor-a"), false);
  const oldQuery = fence.begin("actor-a");
  assert.ok(oldQuery);
  fence.focus("actor-a"); // user changes query before success/failure arrives
  assert.equal(fence.isCurrent(oldQuery, "actor-a"), false);
  const nextQuery = fence.begin("actor-a");
  assert.ok(nextQuery);
  assert.equal(fence.isCurrent(nextQuery, "actor-a"), true);
  fence.blur();
  fence.focus("actor-b");
  assert.equal(fence.isCurrent(nextQuery, "actor-b"), false);
  const nextFriends = fence.begin("actor-b");
  assert.ok(nextFriends);
  assert.equal(fence.isCurrent(nextFriends, "actor-b"), true);
});
