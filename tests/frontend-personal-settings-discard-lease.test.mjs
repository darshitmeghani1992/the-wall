/* eslint-disable import/namespace -- Node runner loads TS via --experimental-strip-types. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/personal-wall-settings.tsx", import.meta.url), "utf8");

test("unsaved Personal Wall settings confirmation is leased to the actor that opened it", () => {
  assert.match(source, /const discardPromptOpen = useRef\(false\)/);
  assert.match(source, /if \(mutationInFlight\.current \|\| discardPromptOpen\.current\) return/);
  assert.match(source, /const token = actionFence\.current\.begin\(currentActorId\.current\)/);
  assert.match(source, /if \(!actionFence\.current\.isCurrent\(token, currentActorId\.current\)\) return;\s+discardPromptOpen\.current = false;\s+allowBackRef\.current = true;\s+navigation\.dispatch\(event\.data\.action\)/);
  assert.match(source, /actionFence\.current\.blur\(\);\s+discardPromptOpen\.current = false/);
});

test("old actor's late discard cannot navigate after switching accounts", () => {
  const fence = new SessionFocusFence();
  const dispatched = [];
  fence.focus("A");
  const captured = fence.begin("A");
  assert.ok(captured);
  let promptOpen = true;
  fence.blur();
  promptOpen = false;
  fence.focus("B");
  if (fence.isCurrent(captured, "B")) dispatched.push("old-discard");
  assert.deepEqual(dispatched, []);
  const now = fence.begin("B");
  assert.ok(now);
  promptOpen = true;
  if (fence.isCurrent(now, "B")) {
    dispatched.push("B-discard");
    promptOpen = false;
  }
  assert.deepEqual(dispatched, ["B-discard"]);
  assert.equal(promptOpen, false);
});

test("one dialog per actor is permitted while save is inactive", () => {
  const mayPrompt = (busy, promptOpen, dirty, allowBack) =>
    dirty && !allowBack && !busy && !promptOpen;
  assert.equal(mayPrompt(false, false, true, false), true);
  assert.equal(mayPrompt(true, false, true, false), false);
  assert.equal(mayPrompt(false, true, true, false), false);
  assert.equal(mayPrompt(false, false, false, false), false);
});
