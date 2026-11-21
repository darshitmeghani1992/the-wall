/* eslint-disable import/namespace -- Node strips TypeScript at test runtime. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/shared/[id]/members.tsx", import.meta.url), "utf8");
const searchBody = source.slice(source.indexOf("  async function search() {"), source.indexOf("  async function invite("));
assert.ok(searchBody.startsWith("  async function search() {"), "invite-search handler must exist");

test("invite-lookup searches use independent fence and invalidate when input changes", () => {
  assert.match(source, /const searchFence = useRef\(new SessionFocusFence\(\)\)\.current/);
  assert.match(source, /searchFence\.focus\(userId \?\? null\)/);
  assert.match(source, /searchFence\.blur\(\)/);
  assert.match(searchBody, /const queryAtStart = query\.trim\(\)/);
  assert.match(searchBody, /const token = searchFence\.begin\(userId\)/);
  assert.match(searchBody, /await searchPeople\(userId, queryAtStart\)/);
  assert.match(searchBody, /if \(searchFence\.isCurrent\(token, currentUserId\.current\)\)/);
  assert.doesNotMatch(searchBody, /const token = fence\.begin\(userId\)/);
  assert.match(source, /onChangeText=\{\(value\) => \{ setQuery\(value\); searchFence\.focus\(userId \?\? null\); setSearching\(false\); setResults\(\[\]\); setError\(null\); \}\}/);
});

test("edit, new query and account switch reject previous success and failures", () => {
  const searchFence = new SessionFocusFence();
  const loadingFence = new SessionFocusFence();
  searchFence.focus("owner-a");
  loadingFence.focus("owner-a");
  const stale = searchFence.begin("owner-a");
  assert.ok(stale);
  searchFence.focus("owner-a"); // user changes query before slow request resolves
  assert.equal(searchFence.isCurrent(stale, "owner-a"), false);
  const current = searchFence.begin("owner-a");
  assert.ok(current);
  assert.equal(searchFence.isCurrent(current, "owner-a"), true);
  // Searching again must not invalidate member list loading.
  const loading = loadingFence.begin("owner-a");
  assert.ok(loading);
  searchFence.begin("owner-a");
  assert.equal(loadingFence.isCurrent(loading, "owner-a"), true);
  searchFence.blur();
  searchFence.focus("owner-b");
  assert.equal(searchFence.isCurrent(current, "owner-b"), false);
});

test("an in-flight invite search cannot cancel a member-list load", () => {
  const loadingFence = new SessionFocusFence();
  const searchFence = new SessionFocusFence();
  loadingFence.focus("owner");
  searchFence.focus("owner");
  const load = loadingFence.begin("owner");
  assert.ok(load);
  searchFence.begin("owner");
  assert.equal(loadingFence.isCurrent(load, "owner"), true);
});
