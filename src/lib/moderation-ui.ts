import type { ModerationAction, ModerationActionPage, ReportRow } from "./moderation";

export type ModerationQueueTab = "open" | "closed" | "audit";

export type ModerationLoadResult = {
  reports: ReportRow[];
  actionPage: ModerationActionPage;
  historyIncomplete: boolean;
};

export function reconcileModerationLoad(
  openResult: PromiseSettledResult<ReportRow[]>,
  resolvedResult: PromiseSettledResult<ReportRow[]>,
  dismissedResult: PromiseSettledResult<ReportRow[]>,
  actionResult: PromiseSettledResult<ModerationActionPage>,
): ModerationLoadResult {
  if (openResult.status === "rejected") throw openResult.reason;
  return {
    reports: [
      ...openResult.value,
      ...(resolvedResult.status === "fulfilled" ? resolvedResult.value : []),
      ...(dismissedResult.status === "fulfilled" ? dismissedResult.value : []),
    ],
    actionPage: actionResult.status === "fulfilled"
      ? actionResult.value
      : { items: [], nextCursor: null },
    historyIncomplete: resolvedResult.status === "rejected"
      || dismissedResult.status === "rejected"
      || actionResult.status === "rejected",
  };
}

export function appendUniqueModerationActions(
  current: readonly ModerationAction[],
  older: readonly ModerationAction[],
): ModerationAction[] {
  const knownIds = new Set(current.map((action) => action.id));
  return [...current, ...older.filter((action) => !knownIds.has(action.id))];
}

export function groupModerationReports(reports: readonly ReportRow[]): {
  open: ReportRow[];
  closed: ReportRow[];
} {
  return {
    open: reports.filter((report) => report.status === "open"),
    closed: reports
      .filter((report) => report.status !== "open")
      .sort((left, right) => (
        right.resolved_at ?? right.created_at
      ).localeCompare(left.resolved_at ?? left.created_at)),
  };
}

export function moderationReportTarget(report: Pick<ReportRow, "mark_id" | "reported_user_id">): string {
  if (report.mark_id) return "MARK";
  if (report.reported_user_id) return "ACCOUNT";
  return "SHARED WALL";
}

export function moderationActionLabel(action: ModerationAction["action"]): string {
  switch (action) {
    case "remove_mark": return "Mark removed";
    case "suspend_account": return "Account suspended";
    case "resolve_report": return "Report resolved";
    case "dismiss_report": return "Report dismissed";
  }
}

export function moderationActionTarget(action: ModerationAction): string {
  if (action.target_mark_id) return `MARK ${action.target_mark_id.slice(0, 8)}`;
  if (action.target_user_id) return `ACCOUNT ${action.target_user_id.slice(0, 8)}`;
  if (action.report_id) return `REPORT ${action.report_id.slice(0, 8)}`;
  return "TARGET UNAVAILABLE";
}
