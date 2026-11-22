/* eslint-disable import/namespace -- Node test runner strips TS types. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/shared/[id]/members.tsx", import.meta.url), "utf8");

test("membership roster and invite query unmount before new viewer/Wall draws", () => {
  assert.match(source, /SharedWallMembersEditor key=\{JSON.stringify\(\[userId, wallId\]\)\}/);
  assert.match(source, /setWall\(null\); setMembers\(\[\]\); setRemoved\(\[\]\); setResults\(\[\]\); setBusyId\(null\)/);
  const key = (actor, wall) => JSON.stringify([actor, wall]);
  assert.notEqual(key("A", "W1"), key("B", "W1"));
  assert.notEqual(key("A", "W1"), key("A", "W2"));
  assert.notEqual(key("A", "W1"), key(null, "W1"));
});

test("old native confirmation is ignored after account switch or blur", () => {
  assert.match(source, /const confirmationToken = mutationFence\.begin\(userId\)/g);
  assert.equal((source.match(/mutationFence\.isCurrent\(confirmationToken, currentUserId\.current\)/g) ?? []).length, 2);
  assert.match(source, /!userId \|\| !isOwner \|\| busyId \|\| mutationInFlight\.current/);
  assert.match(source, /mutationFence\.blur\(\)/);
  const fence = new SessionFocusFence();
  fence.focus("A");
  const oldDialog = fence.begin("A");
  assert.ok(oldDialog);
  fence.blur();
  fence.focus("B");
  let mutated = false;
  if (fence.isCurrent(oldDialog, "B")) mutated = true;
  assert.equal(mutated, false);
  const newDialog = fence.begin("B");
  assert.ok(newDialog);
  if (fence.isCurrent(newDialog, "B")) mutated = true;
  assert.equal(mutated, true);
});

test("sign-out never renders stale roster retry under no authenticated actor", () => {
  assert.match(source, /\) : userId && wallId \? <Pressable accessibilityRole="button" onPress=\{\(\) => void load\(\)\}/);
});
