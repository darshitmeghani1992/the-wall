/* eslint-disable import/namespace -- Node runs source TypeScript under --experimental-strip-types. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";
import { StatusRemovalGuard } from "../src/lib/status-contract.ts";

const screen = readFileSync(new URL("../app/status.tsx", import.meta.url), "utf8");

test("Status save/remove use a mutation lease distinct from read refresh", () => {
  assert.match(screen, /const actionFence = useRef\(new SessionFocusFence\(\)\)\.current/);
  assert.match(screen, /actionFence\.focus\(userId \?\? null\)/);
  assert.match(screen, /actionFence\.blur\(\)/);
  assert.match(screen, /removalGuard\.resetSession\(\)/);
  assert.equal((screen.match(/const token = actionFence\.begin\(userId\)/g) ?? []).length, 2);
  assert.equal((screen.match(/if \(actionFence\.isCurrent\(token, currentUserId\.current\)\) \{\s+removalGuard\.finishOperation\(\);\s+setBusy\(null\);/g) ?? []).length, 2);
  assert.match(screen, /subject !== currentSubjectRef\.current \|\| !canSave/);
  assert.match(screen, /subject !== currentSubjectRef\.current \|\| !visibleStatus/);
});

test("old session network finally never releases new session's busy removal gate", () => {
  const readFence = new SessionFocusFence();
  const actionFence = new SessionFocusFence();
  const guard = new StatusRemovalGuard();
  readFence.focus("A");
  actionFence.focus("A");
  assert.equal(guard.beginOperation(), true);
  const oldSave = actionFence.begin("A");
  assert.ok(oldSave);
  readFence.begin("A"); // a concurrent read must not cancel the in-flight mutation
  assert.equal(actionFence.isCurrent(oldSave, "A"), true);
  actionFence.blur();
  guard.resetSession();
  actionFence.focus("B");
  assert.equal(guard.beginOperation(), true);
  const newSave = actionFence.begin("B");
  assert.ok(newSave);
  if (actionFence.isCurrent(oldSave, "B")) guard.finishOperation(); // old A finally
  assert.equal(guard.beginOperation(), false, "B must remain locked while its own call is pending");
  if (actionFence.isCurrent(newSave, "B")) guard.finishOperation();
  assert.equal(guard.beginOperation(), true, "B releases only its own lock");
});

test("discard and remove confirmation from A cannot apply to actor B", () => {
  assert.match(screen, /const token = actionFence\.begin\(userId \?\? null\)/);
  assert.match(screen, /if \(!actionFence\.isCurrent\(token, currentUserId\.current\)\s*\|\| subject !== currentSubjectRef\.current\) return/);
  assert.match(screen, /subject !== currentSubjectRef\.current\) return;\s+promptOpen\.current = false;\s+queueApprovedRemoval\(action\)/);
  const fence = new SessionFocusFence();
  fence.focus("A");
  const stale = fence.begin("A");
  assert.ok(stale);
  fence.blur();
  fence.focus("B");
  assert.equal(fence.isCurrent(stale, "B"), false);
});
