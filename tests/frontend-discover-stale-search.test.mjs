import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizePeopleSearchQuery } from "../src/lib/relationship-ui.ts";
import { normalizeSharedWallSearch } from "../src/lib/shared-wall-contract.ts";

const screen = readFileSync(new URL("../app/(tabs)/discover.tsx", import.meta.url), "utf8");

function searchCatchBetween(start, end) {
  const from = screen.indexOf(start);
  const to = screen.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  const body = screen.slice(from, to);
  const caught = body.indexOf("} catch (cause: any) {");
  const final = body.indexOf("} finally {", caught);
  assert.ok(caught >= 0 && final > caught);
  return body.slice(caught, final);
}

test("people search failures require matching normalized input AND current session", () => {
  const caught = searchCatchBetween("async function runSearch()", "async function runWallSearch()");
  assert.match(caught, /searchFence\.current\.isCurrent\(token, currentUserId\.current\)/);
  assert.match(caught, /&& normalizePeopleSearchQuery\(currentQuery\.current\) === normalized/);
  const initial = normalizePeopleSearchQuery("@Alice");
  assert.equal(normalizePeopleSearchQuery("  @Alice  "), initial);
  assert.notEqual(normalizePeopleSearchQuery("@Bob"), initial);
});

test("Shared Wall search failures are ignored when current query has changed", () => {
  const caught = searchCatchBetween("async function runWallSearch()", "async function perform(");
  assert.match(caught, /searchFence\.current\.isCurrent\(token, currentUserId\.current\)/);
  assert.match(caught, /&& normalizeSharedWallSearch\(currentQuery\.current\) === normalized/);
  const initial = normalizeSharedWallSearch("  Weekend Trip ");
  assert.equal(normalizeSharedWallSearch("Weekend Trip"), initial);
  assert.notEqual(normalizeSharedWallSearch("College Trip"), initial);
});

test("successful search results also remain guarded by the same normalized input", () => {
  const people = screen.slice(screen.indexOf("async function runSearch()"), screen.indexOf("async function runWallSearch()"));
  const walls = screen.slice(screen.indexOf("async function runWallSearch()"), screen.indexOf("async function perform("));
  assert.match(people, /if \(normalizePeopleSearchQuery\(currentQuery\.current\) !== normalized\) return/);
  assert.match(walls, /if \(normalizeSharedWallSearch\(currentQuery\.current\) !== normalized\) return/);
});
