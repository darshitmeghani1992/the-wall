/* eslint-disable import/namespace -- Node strips TypeScript for this contract suite. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const focusBody = source.slice(
  source.indexOf("  useFocusEffect("),
  source.indexOf("  useEffect(() => {\n    let active = true;"),
);
assert.ok(focusBody.startsWith("  useFocusEffect("), "home focus scope must exist");

test("My Wall clears old Shared Wall tabs before refreshing a new actor", () => {
  const focus = focusBody.indexOf("sharedWallsFence.focus(userId ?? null)");
  const clear = focusBody.indexOf("setSharedWalls([])");
  const clearError = focusBody.indexOf("setSharedWallsError(false)");
  const refresh = focusBody.indexOf("void refreshSharedWalls()");
  assert.ok(focus >= 0 && focus < clear, "reset must occur after binding actor");
  assert.ok(clear < refresh, "old Wall tabs must disappear before new request");
  assert.ok(clearError < refresh, "old loading errors must clear before new request");
  assert.match(focusBody, /if \(userId && accountRoute === "ready"\) void refreshSharedWalls\(\)/);
  assert.match(focusBody, /sharedWallsFence\.blur\(\)/);
});

test("late prior-account Shared Wall replies cannot repaint the next session", () => {
  const fence = new SessionFocusFence();
  fence.focus("actor-a");
  const requestA = fence.begin("actor-a");
  assert.ok(requestA);
  let visibleWalls = ["A private Shared Wall"];
  fence.blur();
  fence.focus("actor-b");
  visibleWalls = []; // immediate on-focus reset, not dependent on new fetch
  assert.equal(fence.isCurrent(requestA, "actor-b"), false);
  if (fence.isCurrent(requestA, "actor-b")) visibleWalls = ["A private Shared Wall"];
  assert.deepEqual(visibleWalls, []);
  const requestB = fence.begin("actor-b");
  assert.ok(requestB);
  assert.equal(fence.isCurrent(requestB, "actor-b"), true);
});
