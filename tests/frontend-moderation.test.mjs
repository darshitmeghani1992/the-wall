/* eslint-disable import/namespace -- Node loads the TypeScript coordinator directly. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runModerationActionFlow } from "../src/lib/moderation-flow.ts";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function base(overrides = {}) {
  const events = [];
  return {
    events,
    input: {
      expectedActorId: "admin-a",
      reportId: "report-1",
      targetId: "target-1",
      targetAction: "none",
      finalStatus: "resolved",
      reason: "reviewed",
      isCurrent: () => true,
      removeMark: async (...args) => events.push(["remove", ...args]),
      suspendAccount: async (...args) => events.push(["suspend", ...args]),
      resolveReport: async (...args) => events.push(["resolve", ...args]),
      onComplete: (...args) => events.push(["complete", ...args]),
      onError: () => events.push(["error"]),
      onFinally: () => events.push(["finally"]),
      ...overrides,
    },
  };
}

test("Mark moderation executes target action before resolving the report", async () => {
  const { events, input } = base({ targetAction: "remove_mark" });
  await runModerationActionFlow(input);
  assert.deepEqual(events, [
    ["remove", "admin-a", "target-1", "reviewed"],
    ["resolve", "admin-a", "report-1", "resolved", "reviewed"],
    ["complete", "report-1"],
    ["finally"],
  ]);
});

test("account moderation executes suspension before resolving the report", async () => {
  const { events, input } = base({ targetAction: "suspend_user" });
  await runModerationActionFlow(input);
  assert.deepEqual(events[0], ["suspend", "admin-a", "target-1", "reviewed"]);
  assert.deepEqual(events[1], ["resolve", "admin-a", "report-1", "resolved", "reviewed"]);
});

test("a session switch after the target action suppresses report closure and UI callbacks", async () => {
  const pending = deferred();
  const events = [];
  let current = true;
  const { input } = base({
    targetAction: "remove_mark",
    isCurrent: () => current,
    removeMark: async () => { events.push(["remove"]); await pending.promise; },
    resolveReport: async () => events.push(["resolve"]),
    onComplete: () => events.push(["complete"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });
  const flow = runModerationActionFlow(input);
  await Promise.resolve();
  current = false;
  pending.resolve();
  await flow;
  assert.deepEqual(events, [["remove"]]);
});

test("target-action failure never closes the report", async () => {
  const { events, input } = base({
    targetAction: "suspend_user",
    suspendAccount: async () => { throw new Error("denied"); },
  });
  await runModerationActionFlow(input);
  assert.deepEqual(events, [["error"], ["finally"]]);
});

test("moderation surface is admin-gated and wired to actor-bound services", () => {
  const screen = readFileSync("app/moderation.tsx", "utf8");
  const settings = readFileSync("app/settings.tsx", "utf8");
  const service = readFileSync("src/lib/moderation.ts", "utf8");
  assert.match(settings, /profile\?\.is_admin/);
  assert.match(screen, /!isAdmin/);
  assert.match(screen, /runModerationActionFlow/);
  assert.match(screen, /listModerationActions\(token\.userId\)/);
  assert.match(screen, /listModerationActions\(token\.userId, nextActionCursor\)/);
  assert.match(screen, /Load older actions/);
  assert.match(screen, /appendUniqueModerationActions/);
  assert.match(screen, /reconcileModerationLoad/);
  assert.match(screen, /Promise\.allSettled/);
  assert.match(screen, /The open queue is still available/);
  assert.match(screen, /groupModerationReports\(reports\)/);
  assert.match(screen, /accessibilityRole="tablist"/);
  assert.match(service, /p_expected_actor_id: actorId/);
  assert.match(service, /cursor\?: ModerationActionCursor/);
  assert.match(service, /\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: false \}\)/);
  assert.match(service, /MODERATION_ACTION_PAGE_SIZE \+ 1/);
  assert.match(service, /query\.or\(moderationActionCursorFilter\(cursor\)\)/);
  assert.doesNotMatch(service, /\.limit\(200\)/);
  assert.doesNotMatch(service, /rpc\("admin_remove_mark", \{ p_mark_id/);
  assert.doesNotMatch(service, /rpc\("admin_suspend_account", \{ p_user_id/);
  assert.doesNotMatch(service, /rpc\("admin_resolve_report", \{\s*p_report_id/);
});
