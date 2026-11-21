/* eslint-disable import/namespace -- Node test runner strips TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const screen = readFileSync(new URL("../app/(tabs)/discover.tsx", import.meta.url), "utf8");
const start = screen.indexOf("useFocusEffect(useCallback(() => {");
const end = screen.indexOf("\n  async function runSearch()", start);
assert.ok(start >= 0 && end > start, "Discover focus lifecycle exists");
const focus = screen.slice(start, end);

test("Discover clears both People and public Shared Wall searches on focus or actor change", () => {
  assert.match(focus, /searchFence\\.current\\.focus\\(nextUserId\\)/);
  assert.match(focus, /setResults\\(\\[\\]\\);\\s*[\\s\\S]*?setWallResults\\(\\[\\]\\);/);
  assert.match(focus, /setSearchedQuery\\(null\\)/);
  assert.match(focus, /setFriends\\(\\[\\]\\)/);
  assert.match(focus, /setIncoming\\(\\[\\]\\)/);
  assert.match(focus, /if \\(nextUserId\\) void loadNetwork\\(\\);\\s*else setLoading\\(false\\)/);
});

test("old account's pending Shared Wall search cannot repaint after switch or sign-out", () => {
  const fence = new SessionFocusFence();
  fence.focus("actor-a");
  const oldRequest = fence.begin("actor-a");
  assert.ok(oldRequest);
  fence.blur();
  fence.focus("actor-b");
  assert.equal(fence.isCurrent(oldRequest, "actor-b"), false);
  const newRequest = fence.begin("actor-b");
  assert.ok(newRequest);
  assert.equal(fence.isCurrent(newRequest, "actor-b"), true);
  fence.blur();
  fence.focus(null);
  assert.equal(fence.begin(null), null);
  assert.equal(fence.isCurrent(newRequest, null), false);
});
