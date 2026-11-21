/* eslint-disable import/namespace -- Node strips TypeScript at test runtime. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";
import { beginExclusiveMutation, endExclusiveMutation } from "../src/lib/mutation-guard.ts";

const source = readFileSync(new URL("../app/shared/[id]/members.tsx", import.meta.url), "utf8");
const action = (start, end) => {
  const begin = source.indexOf(start);
  const finish = source.indexOf(end, begin);
  assert.ok(begin >= 0 && finish > begin, `missing action boundaries: ${start}`);
  return source.slice(begin, finish);
};

test("Shared Wall member mutations own a separate account/focus lease", () => {
  assert.match(source, /const mutationFence = useRef\(new SessionFocusFence\(\)\)\.current/);
  assert.match(source, /mutationFence\.focus\(userId \?\? null\)/);
  assert.match(source, /mutationFence\.blur\(\)/);
  const mutations = [
    action("  async function invite(", "  function confirmRemove("),
    action("  async function remove(", "  function confirmTransfer("),
    action("  async function transfer(", "  return (\n"),
  ];
  for (const mutation of mutations) {
    assert.match(mutation, /const token = mutationFence\.begin\(userId\)/);
    assert.match(mutation, /if \(!mutationFence\.isCurrent\(token, currentUserId\.current\)\) return/);
    assert.match(mutation, /finally \{[\s\S]*?if \(mutationFence\.isCurrent\(token, currentUserId\.current\)\) \{\s*endExclusiveMutation\(mutationInFlight\);\s*setBusyId\(null\);/);
    assert.doesNotMatch(mutation, /finally \{\s*endExclusiveMutation\(mutationInFlight\)/);
  }
});

test("unrelated refresh and search requests cannot strand a member mutation lock", () => {
  const readFence = new SessionFocusFence();
  const mutationFence = new SessionFocusFence();
  const lock = { current: false };
  readFence.focus("actor-a");
  mutationFence.focus("actor-a");
  assert.equal(beginExclusiveMutation(lock), true);
  const token = mutationFence.begin("actor-a");
  assert.ok(token);
  // The member screen refreshes after invite/removal, using the read fence.
  readFence.begin("actor-a");
  readFence.begin("actor-a"); // an overlapping people search
  assert.equal(mutationFence.isCurrent(token, "actor-a"), true);
  if (mutationFence.isCurrent(token, "actor-a")) endExclusiveMutation(lock);
  assert.equal(lock.current, false);
});

test("late request from a previous account cannot unlock a new owner's mutation", () => {
  const mutationFence = new SessionFocusFence();
  const lock = { current: false };
  mutationFence.focus("actor-a");
  assert.equal(beginExclusiveMutation(lock), true);
  const previous = mutationFence.begin("actor-a");
  assert.ok(previous);

  // Focus cleanup on account switch releases only actor A's old lock.
  mutationFence.blur();
  endExclusiveMutation(lock);
  mutationFence.focus("actor-b");
  assert.equal(beginExclusiveMutation(lock), true);
  const current = mutationFence.begin("actor-b");
  assert.ok(current);

  // Actor A completes after actor B has started a member action.
  if (mutationFence.isCurrent(previous, "actor-b")) endExclusiveMutation(lock);
  assert.equal(lock.current, true);
  assert.equal(beginExclusiveMutation(lock), false);
  if (mutationFence.isCurrent(current, "actor-b")) endExclusiveMutation(lock);
  assert.equal(lock.current, false);
});
