import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's strip-types runner needs the source extension.
import { ReactionRequestTracker } from "./reaction-request-tracker.ts";

test("a cancelled reaction request can be retried after a page rerender", async () => {
  const tracker = new ReactionRequestTracker();
  const first = tracker.claim(["first", "focused"]);
  assert.deepEqual(first.ids, ["first", "focused"]);
  first.abandon(); // effect cleanup while server response is delayed
  const second = tracker.claim(["first", "focused", "older"]);
  assert.deepEqual(second.ids, ["first", "focused", "older"]);
  first.abandon(); // delayed rejection from the stale request
  assert.equal(tracker.has("first"), true);
  assert.deepEqual(tracker.claim(["first"]).ids, []);
  second.abandon(); // new request fails and may be retried
  assert.deepEqual(tracker.claim(["first", "focused", "older"]).ids, ["first", "focused", "older"]);
});

test("account reset discards all claimed and loaded IDs", () => {
  const tracker = new ReactionRequestTracker();
  tracker.claim(["same-mark"]);
  tracker.clear();
  assert.deepEqual(tracker.claim(["same-mark"]).ids, ["same-mark"]);
});
