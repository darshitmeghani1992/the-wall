/* eslint-disable import/namespace -- Node strips TS at test runtime. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";
import { beginExclusiveMutation, endExclusiveMutation } from "../src/lib/mutation-guard.ts";

const source = readFileSync(new URL("../app/shared/create.tsx", import.meta.url), "utf8");
const begin = source.indexOf("  async function submit() {");
const end = source.indexOf("\n  function chooseVisibility", begin);
assert.ok(begin >= 0 && end > begin, "Shared Wall submit handler present");
const submit = source.slice(begin, end);

test("Shared Wall completion only releases current actor's mutation lock", () => {
  assert.match(submit, /const token = fence\.begin\(userId\)/);
  assert.match(submit, /if \(!fence\.isCurrent\(token, currentUserId\.current\)\) return/);
  assert.match(submit, /finally \{\s*\/\/[^\n]*\n\s*if \(fence\.isCurrent\(token, currentUserId\.current\)\) \{\s*endExclusiveMutation\(mutationInFlight\)/);
  assert.doesNotMatch(submit, /finally \{\s*endExclusiveMutation\(mutationInFlight\)/);
});

test("stale completion cannot free the lock already held by a new account", () => {
  const fence = new SessionFocusFence();
  const mutationInFlight = { current: false };
  fence.focus("actor-a");
  assert.equal(beginExclusiveMutation(mutationInFlight), true);
  const old = fence.begin("actor-a");
  assert.ok(old);
  // Focus cleanup on account change releases the old actor's pending claim.
  fence.blur();
  endExclusiveMutation(mutationInFlight);
  fence.focus("actor-b");
  assert.equal(beginExclusiveMutation(mutationInFlight), true);
  const next = fence.begin("actor-b");
  assert.ok(next);
  // Old request finally executes AFTER actor-b's creation started.
  if (fence.isCurrent(old, "actor-b")) endExclusiveMutation(mutationInFlight);
  assert.equal(mutationInFlight.current, true);
  assert.equal(beginExclusiveMutation(mutationInFlight), false);
  if (fence.isCurrent(next, "actor-b")) endExclusiveMutation(mutationInFlight);
  assert.equal(mutationInFlight.current, false);
});
