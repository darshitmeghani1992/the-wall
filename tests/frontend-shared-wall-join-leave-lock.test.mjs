/* eslint-disable import/namespace -- Node strips TypeScript at test runtime. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";
import { beginExclusiveMutation, endExclusiveMutation } from "../src/lib/mutation-guard.ts";

const source = readFileSync(new URL("../app/shared/[id].tsx", import.meta.url), "utf8");
const slice = (a, b) => {
  const start = source.indexOf(a);
  const end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
};

test("Shared Wall join/leave hold mutation-specific account and wall ownership", () => {
  assert.match(source, /const mutationFence = useRef\(new SessionFocusFence\(\)\)\.current/);
  assert.match(source, /mutationFence\.focus\(userId \?\? null\)/);
  assert.match(source, /mutationFence\.blur\(\)/);
  for (const action of [
    slice("  async function join() {", "  function confirmLeave()"),
    slice("  async function leave() {", "  async function share()"),
  ]) {
    assert.match(action, /const token = mutationFence\.begin\(userId\)/);
    assert.match(action, /if \(!mutationFence\.isCurrent\(token, currentUserId\.current\)\) return/);
    assert.match(action, /finally \{[\s\S]*?if \(mutationFence\.isCurrent\(token, currentUserId\.current\)\) \{\s*endExclusiveMutation\(mutationInFlight\);\s*setBusy\(null\);/);
    assert.doesNotMatch(action, /finally \{\s*endExclusiveMutation\(mutationInFlight\)/);
  }
});

test("Wall refresh cannot invalidate same-user join/leave lock cleanup", () => {
  const readFence = new SessionFocusFence();
  const mutationFence = new SessionFocusFence();
  const lock = { current: false };
  readFence.focus("actor");
  mutationFence.focus("actor");
  assert.equal(beginExclusiveMutation(lock), true);
  const mutation = mutationFence.begin("actor");
  assert.ok(mutation);
  readFence.begin("actor"); // successful join calls load()
  assert.equal(mutationFence.isCurrent(mutation, "actor"), true);
  if (mutationFence.isCurrent(mutation, "actor")) endExclusiveMutation(lock);
  assert.equal(lock.current, false);
});

test("a prior actor's late join/leave completion cannot unlock the new actor", () => {
  const fence = new SessionFocusFence();
  const lock = { current: false };
  fence.focus("actor-a");
  assert.equal(beginExclusiveMutation(lock), true);
  const old = fence.begin("actor-a");
  assert.ok(old);
  fence.blur();
  endExclusiveMutation(lock); // focus cleanup on account or Wall change
  fence.focus("actor-b");
  assert.equal(beginExclusiveMutation(lock), true);
  const next = fence.begin("actor-b");
  assert.ok(next);
  if (fence.isCurrent(old, "actor-b")) endExclusiveMutation(lock);
  assert.equal(lock.current, true);
  assert.equal(beginExclusiveMutation(lock), false);
  if (fence.isCurrent(next, "actor-b")) endExclusiveMutation(lock);
  assert.equal(lock.current, false);
});
