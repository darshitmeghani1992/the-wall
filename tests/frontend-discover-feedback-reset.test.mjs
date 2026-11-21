/* eslint-disable import/namespace -- Node test runner supports stripped TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/(tabs)/discover.tsx", import.meta.url), "utf8");

function between(start, end) {
  const first = source.indexOf(start);
  assert.ok(first >= 0, `Missing screen hook: ${start}`);
  const last = source.indexOf(end, first);
  assert.ok(last > first, `Missing end of screen hook: ${end}`);
  return source.slice(first, last);
}

test("typing a new Discover query resets the prior search error and busy state", () => {
  const onChange = between("onChangeText={(value) => {", "onSubmitEditing={runSearch}");
  assert.match(onChange, /setQuery\(value\)/);
  assert.match(onChange, /currentQuery\.current = value/);
  assert.match(onChange, /searchFence\.current\.focus\(userId \?\? null\)/);
  assert.match(onChange, /setSearching\(false\)/);
  assert.match(onChange, /setError\(null\)/);
  assert.match(onChange, /setSearchedQuery\(null\)/);
  assert.match(onChange, /setResults\(\[\]\)/);
  assert.match(onChange, /setWallResults\(\[\]\)/);
});

test("switching Discover category invalidates the old result and clears its spinner", () => {
  const tabPress = between(
    "onPress={() => {\n                searchFence.current.focus(userId ?? null);",
    "style={{\n                flex: 1,",
  );
  assert.match(tabPress, /searchFence\.current\.focus\(userId \?\? null\)/);
  assert.match(tabPress, /setMode\(choice\)/);
  assert.match(tabPress, /setSearching\(false\)/);
  assert.match(tabPress, /setQuery\(""\)/);
  assert.match(tabPress, /setError\(null\)/);
  assert.match(tabPress, /setResults\(\[\]\)/);
  assert.match(tabPress, /setWallResults\(\[\]\)/);
});

test("focus fence invalidates pending previous-category or previous-query searches", () => {
  const fence = new SessionFocusFence();
  fence.focus("actor-1");
  const old = fence.begin("actor-1");
  assert.ok(old);
  assert.equal(fence.isCurrent(old, "actor-1"), true);
  fence.focus("actor-1"); // query edit / tab switch
  assert.equal(fence.isCurrent(old, "actor-1"), false);
  const current = fence.begin("actor-1");
  assert.ok(current);
  assert.equal(fence.isCurrent(current, "actor-1"), true);
  fence.blur();
  assert.equal(fence.isCurrent(current, "actor-1"), false);
});
