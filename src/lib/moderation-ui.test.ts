import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { appendUniqueModerationActions, groupModerationReports, moderationActionLabel, moderationActionTarget, moderationReportTarget, reconcileModerationLoad } from "./moderation-ui.ts";

const baseReport = {
  id: "10000000-0000-4000-8000-000000000001",
  reporter_id: "10000000-0000-4000-8000-000000000002",
  mark_id: null,
  reported_user_id: null,
  reported_wall_id: "10000000-0000-4000-8000-000000000003",
  reason: "spam",
  details: null,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-09-22T00:00:00.000Z",
} as const;

const reports = [
  { ...baseReport, id: "open", status: "open" as const },
  { ...baseReport, id: "resolved", status: "resolved" as const, resolved_at: "2026-09-22T01:00:00.000Z" },
  { ...baseReport, id: "dismissed", status: "dismissed" as const, resolved_at: "2026-09-22T02:00:00.000Z" },
];
assert.deepEqual(groupModerationReports(reports).open.map((report) => report.id), ["open"]);
assert.deepEqual(groupModerationReports(reports).closed.map((report) => report.id), ["dismissed", "resolved"]);
assert.equal(moderationReportTarget(baseReport), "SHARED WALL");
assert.equal(moderationReportTarget({ mark_id: "mark", reported_user_id: null }), "MARK");
assert.equal(moderationReportTarget({ mark_id: null, reported_user_id: "user" }), "ACCOUNT");

assert.equal(moderationActionLabel("remove_mark"), "Mark removed");
assert.equal(moderationActionLabel("suspend_account"), "Account suspended");
assert.equal(moderationActionLabel("resolve_report"), "Report resolved");
assert.equal(moderationActionLabel("dismiss_report"), "Report dismissed");
assert.equal(moderationActionTarget({
  id: "action",
  actor_id: null,
  action: "resolve_report",
  target_mark_id: null,
  target_user_id: null,
  report_id: "abcdef12-0000-4000-8000-000000000001",
  reason: null,
  created_at: "2026-09-22T00:00:00.000Z",
}), "REPORT abcdef12");

const action = {
  id: "30000000-0000-4000-8000-000000000001",
  actor_id: "30000000-0000-4000-8000-000000000002",
  action: "resolve_report" as const,
  target_mark_id: null,
  target_user_id: null,
  report_id: baseReport.id,
  reason: "reviewed",
  created_at: "2026-09-22T03:00:00.000Z",
};
const actionPage = { items: [action], nextCursor: { id: action.id, created_at: action.created_at } };
const fulfilled = <Value>(value: Value): PromiseFulfilledResult<Value> => ({ status: "fulfilled", value });
const rejected = (label: string): PromiseRejectedResult => ({ status: "rejected", reason: new Error(label) });

for (let failureMask = 0; failureMask < 8; failureMask += 1) {
  const resolvedResult = failureMask & 1 ? rejected("resolved") : fulfilled([reports[1]]);
  const dismissedResult = failureMask & 2 ? rejected("dismissed") : fulfilled([reports[2]]);
  const actionResult = failureMask & 4 ? rejected("actions") : fulfilled(actionPage);
  const result = reconcileModerationLoad(fulfilled([reports[0]]), resolvedResult, dismissedResult, actionResult);
  assert.equal(result.reports[0]?.id, "open");
  assert.equal(result.reports.some((report) => report.id === "resolved"), !(failureMask & 1));
  assert.equal(result.reports.some((report) => report.id === "dismissed"), !(failureMask & 2));
  assert.equal(result.actionPage.items.length, failureMask & 4 ? 0 : 1);
  assert.equal(result.historyIncomplete, failureMask !== 0);
}

const openFailure = new Error("open queue unavailable");
assert.throws(
  () => reconcileModerationLoad({ status: "rejected", reason: openFailure }, fulfilled([]), fulfilled([]), fulfilled(actionPage)),
  openFailure,
);
assert.deepEqual(
  appendUniqueModerationActions([action], [action, { ...action, id: "30000000-0000-4000-8000-000000000003" }]).map(({ id }) => id),
  [action.id, "30000000-0000-4000-8000-000000000003"],
);

console.log("moderation UI contract: grouping, failure isolation, pagination merge, and audit labels passed");
