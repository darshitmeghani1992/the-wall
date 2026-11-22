/* eslint-disable import/namespace -- Node runner loads TS through --experimental-strip-types. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";
import { beginExclusiveMutation, endExclusiveMutation } from "../src/lib/mutation-guard.ts";

const source = readFileSync(new URL("../app/shared/[id]/settings.tsx", import.meta.url), "utf8");

test("Shared Wall settings remount on actor and Wall changes, hiding old drafts", () => {
  assert.match(source, /SharedWallSettingsEditor key=\{JSON.stringify\(\[userId, wallId\]\)\}/);
  assert.match(source, /setLoading\(true\); setError\(null\); setOriginalName\(""\)/);
  assert.match(source, /setConfirmingDelete\(false\); setDeleteName\(""\)/);
  const key = (actor, wall) => JSON.stringify([actor, wall]);
  assert.notEqual(key("A", "W1"), key("B", "W1"));
  assert.notEqual(key("A", "W1"), key("A", "W2"));
  assert.notEqual(key("A", "W1"), key(null, "W1"));
  assert.notEqual(key("A", "W1"), key("A", "W1:extra"));
});

test("permanent deletion requires a current signed-in confirmation and exact Wall name", () => {
  assert.match(source, /!userId \|\| !confirmingDelete \|\| !originalName \|\| expectedName !== originalName \|\| loading/);
  assert.match(source, /userId && wallId \? <Button label="Try again"/);
  assert.match(source, /const mutationFence = useRef\(new SessionFocusFence\(\)\)\.current/);
  assert.match(source, /mutationFence\.blur\(\)/);
});

test("prior account's slow save/delete cannot release another account's mutation lock", () => {
  const fence = new SessionFocusFence();
  const locked = { current: false };
  fence.focus("A");
  assert.ok(beginExclusiveMutation(locked));
  const old = fence.begin("A");
  assert.ok(old);
  fence.blur(); endExclusiveMutation(locked);
  fence.focus("B");
  assert.ok(beginExclusiveMutation(locked));
  const current = fence.begin("B");
  assert.ok(current);
  if (fence.isCurrent(old, "B")) endExclusiveMutation(locked);
  assert.equal(locked.current, true);
  if (fence.isCurrent(current, "B")) endExclusiveMutation(locked);
  assert.equal(locked.current, false);
  const releaseGuards = source.match(/if \(mutationFence\.isCurrent\(token, currentUserId\.current\)\) \{\s+endExclusiveMutation\(mutationInFlight\); setBusy\(null\);\s+\}/g);
  assert.equal(releaseGuards?.length, 2, "both save and delete release only their own lease");
});
