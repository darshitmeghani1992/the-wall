import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node --experimental-strip-types contract tests import source.
import { runModerationActionFlow } from "../src/lib/moderation-flow.ts";

const base = () => ({
  expectedActorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  targetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  targetAction: "remove_poll",
  finalStatus: "resolved",
  reason: "Reported Poll",
});

test("Poll moderation removes target before resolving its report and records one completion", async () => {
  const calls = [];
  await runModerationActionFlow({
    ...base(),
    isCurrent: () => true,
    removeMark: async () => assert.fail("must not use legacy Mark removal"),
    removePoll: async (actor, pollId, reason) => { calls.push(["poll", actor, pollId, reason]); },
    suspendAccount: async () => assert.fail("must not suspend"),
    resolveReport: async (actor, reportId, status) => { calls.push(["report", actor, reportId, status]); },
    onComplete: (id) => { calls.push(["done", id]); },
    onError: (error) => assert.fail(String(error)),
    onFinally: () => { calls.push(["finally"]); },
  });
  assert.deepEqual(calls.map((row) => row[0]), ["poll", "report", "done", "finally"]);
});

test("a failed Poll removal cannot silently resolve the report", async () => {
  const calls = [];
  await runModerationActionFlow({
    ...base(),
    isCurrent: () => true,
    removeMark: async () => assert.fail("legacy Mark removal"),
    removePoll: async () => { throw new Error("Poll removal denied"); },
    suspendAccount: async () => assert.fail("unexpected suspension"),
    resolveReport: async () => assert.fail("report closed despite removal failure"),
    onComplete: () => assert.fail("unexpected completion"),
    onError: (cause) => { calls.push(cause.message); },
    onFinally: () => { calls.push("finally"); },
  });
  assert.deepEqual(calls, ["Poll removal denied", "finally"]);
});

test("switching accounts while Poll removal is pending never closes an old report", async () => {
  let current = true;
  let reportClosed = false;
  await runModerationActionFlow({
    ...base(),
    isCurrent: () => current,
    removeMark: async () => assert.fail("legacy Mark removal"),
    removePoll: async () => { current = false; },
    suspendAccount: async () => assert.fail("unexpected suspension"),
    resolveReport: async () => { reportClosed = true; },
    onComplete: () => assert.fail("stale completion"),
    onError: () => assert.fail("stale error"),
    onFinally: () => assert.fail("stale cleanup"),
  });
  assert.equal(reportClosed, false);
});
