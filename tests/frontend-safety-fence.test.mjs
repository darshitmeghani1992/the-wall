/* eslint-disable import/namespace -- Node's type-stripping test runner loads this TypeScript module directly. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  runMarkReportRemovalFlow,
  runSettingsDeactivationFlow,
} from "../src/components/safety-action-flows.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("Settings ignores a delayed deactivation continuation after an account switch", async () => {
  const pending = deferred();
  const events = [];
  let currentActorId = "actor-a";

  const flow = runSettingsDeactivationFlow({
    expectedActorId: "actor-a",
    isCurrent: () => currentActorId === "actor-a",
    deactivate: async (expectedActorId) => {
      events.push(["deactivate", expectedActorId]);
      await pending.promise;
    },
    refreshAccountRoute: async () => events.push(["refresh"]),
    navigateToCanonicalGate: () => events.push(["navigate"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });

  await Promise.resolve();
  currentActorId = "actor-b";
  pending.resolve();
  await flow;

  assert.deepEqual(events, [["deactivate", "actor-a"]]);
});

test("Settings checks the account fence again after route refresh", async () => {
  const pendingRefresh = deferred();
  const events = [];
  let currentActorId = "actor-a";

  const flow = runSettingsDeactivationFlow({
    expectedActorId: "actor-a",
    isCurrent: () => currentActorId === "actor-a",
    deactivate: async () => events.push(["deactivate"]),
    refreshAccountRoute: async () => {
      events.push(["refresh"]);
      await pendingRefresh.promise;
    },
    navigateToCanonicalGate: () => events.push(["navigate"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });

  await Promise.resolve();
  currentActorId = "actor-b";
  pendingRefresh.resolve();
  await flow;

  assert.deepEqual(events, [["deactivate"], ["refresh"]]);
});

test("Settings refreshes before canonical navigation for the initiating account", async () => {
  const events = [];

  await runSettingsDeactivationFlow({
    expectedActorId: "actor-a",
    isCurrent: () => true,
    deactivate: async (expectedActorId) => events.push(["deactivate", expectedActorId]),
    refreshAccountRoute: async () => events.push(["refresh"]),
    navigateToCanonicalGate: () => events.push(["navigate"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });

  assert.deepEqual(events, [
    ["deactivate", "actor-a"],
    ["refresh"],
    ["navigate"],
    ["finally"],
  ]);
});

test("Mark reporting ignores delayed success after a subject switch", async () => {
  const pendingReport = deferred();
  const events = [];
  let currentActorId = "actor-a";
  const currentMarkId = "mark-a";

  const flow = runMarkReportRemovalFlow({
    expectedActorId: "actor-a",
    markId: "mark-a",
    reason: "harassment",
    details: "details",
    alreadyReported: false,
    removeAfterReport: true,
    isCurrent: () => currentActorId === "actor-a" && currentMarkId === "mark-a",
    createReport: async (expectedActorId, input) => {
      events.push(["report", expectedActorId, input.markId]);
      await pendingReport.promise;
    },
    removeMark: async (...args) => events.push(["remove", ...args]),
    onReportSubmitted: () => events.push(["reported"]),
    onMarkRemoved: () => events.push(["removed"]),
    onClose: () => events.push(["close"]),
    onRemovalError: () => events.push(["removal-error"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });

  await Promise.resolve();
  currentActorId = "actor-b";
  pendingReport.resolve();
  await flow;

  assert.deepEqual(events, [["report", "actor-a", "mark-a"]]);
});

test("Mark removal ignores delayed completion after the modal target changes", async () => {
  const pendingRemoval = deferred();
  const events = [];
  const currentActorId = "actor-a";
  let currentMarkId = "mark-a";

  const flow = runMarkReportRemovalFlow({
    expectedActorId: "actor-a",
    markId: "mark-a",
    reason: "spam",
    details: "",
    alreadyReported: false,
    removeAfterReport: true,
    isCurrent: () => currentActorId === "actor-a" && currentMarkId === "mark-a",
    createReport: async (expectedActorId, input) => events.push(["report", expectedActorId, input.markId]),
    removeMark: async (expectedActorId, markId, reason) => {
      events.push(["remove", expectedActorId, markId, reason]);
      await pendingRemoval.promise;
    },
    onReportSubmitted: () => events.push(["reported"]),
    onMarkRemoved: () => events.push(["removed"]),
    onClose: () => events.push(["close"]),
    onRemovalError: () => events.push(["removal-error"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });

  await Promise.resolve();
  currentMarkId = "mark-b";
  pendingRemoval.resolve();
  await flow;

  assert.deepEqual(events, [
    ["report", "actor-a", "mark-a"],
    ["reported"],
    ["remove", "actor-a", "mark-a", "safety"],
  ]);
});

test("Mark reporting suppresses stale errors and cleanup after a target switch", async () => {
  const pendingReport = deferred();
  const events = [];
  let currentMarkId = "mark-a";

  const flow = runMarkReportRemovalFlow({
    expectedActorId: "actor-a",
    markId: "mark-a",
    reason: "other",
    details: "",
    alreadyReported: false,
    removeAfterReport: false,
    isCurrent: () => currentMarkId === "mark-a",
    createReport: async () => pendingReport.promise,
    removeMark: async () => {},
    onReportSubmitted: () => events.push("reported"),
    onMarkRemoved: () => events.push("removed"),
    onClose: () => events.push("close"),
    onRemovalError: () => events.push("removal-error"),
    onError: () => events.push("error"),
    onFinally: () => events.push("finally"),
  });

  await Promise.resolve();
  currentMarkId = "mark-b";
  pendingReport.reject(new Error("late failure"));
  await flow;

  assert.deepEqual(events, []);
});

test("Mark report and safety removal complete in order for the captured subject and target", async () => {
  const events = [];

  await runMarkReportRemovalFlow({
    expectedActorId: "actor-a",
    markId: "mark-a",
    reason: "spam",
    details: "details",
    alreadyReported: false,
    removeAfterReport: true,
    isCurrent: () => true,
    createReport: async (expectedActorId, input) => events.push(["report", expectedActorId, input.markId]),
    removeMark: async (expectedActorId, markId, reason) => events.push(["remove", expectedActorId, markId, reason]),
    onReportSubmitted: () => events.push(["reported"]),
    onMarkRemoved: (markId) => events.push(["removed", markId]),
    onClose: () => events.push(["close"]),
    onRemovalError: () => events.push(["removal-error"]),
    onError: () => events.push(["error"]),
    onFinally: () => events.push(["finally"]),
  });

  assert.deepEqual(events, [
    ["report", "actor-a", "mark-a"],
    ["reported"],
    ["remove", "actor-a", "mark-a", "safety"],
    ["removed", "mark-a"],
    ["close"],
    ["finally"],
  ]);
});
