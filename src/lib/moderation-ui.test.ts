import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { groupModerationReports, moderationActionLabel, moderationActionTarget, moderationReportTarget } from "./moderation-ui.ts";

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

console.log("moderation UI contract: queue grouping and audit labels passed");
