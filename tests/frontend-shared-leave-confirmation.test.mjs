/* eslint-disable import/namespace -- Node contract runner strips TS. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/shared/[id].tsx", import.meta.url), "utf8");

test("leave confirmation requires a loaded matching Wall and no active mutation", () => {
  assert.match(source, /!userId \|\| !wall \|\| wall\.id !== wallId \|\| busy \|\| mutationInFlight\.current/);
  assert.match(source, /const confirmationToken = mutationFence\.begin\(userId\)/);
  assert.match(source, /if \(!mutationFence\.isCurrent\(confirmationToken, currentUserId\.current\) \|\| currentWallId\.current !== wallId\) return/);
  assert.match(source, /mutationFence\.blur\(\)/);
});

test("native Leave Alert from A-W1 cannot mutate B-W1 or A-W2", () => {
  const fence = new SessionFocusFence();
  fence.focus("A");
  const token = fence.begin("A");
  assert.ok(token);
  const canLeave = (actor, currentWall, intendedWall) =>
    fence.isCurrent(token, actor) && currentWall === intendedWall;
  assert.equal(canLeave("A", "W1", "W1"), true);
  assert.equal(canLeave("A", "W2", "W1"), false);
  fence.blur();
  fence.focus("B");
  assert.equal(canLeave("B", "W1", "W1"), false);
  fence.blur();
  fence.focus("A");
  assert.equal(canLeave("A", "W1", "W1"), false);
});
