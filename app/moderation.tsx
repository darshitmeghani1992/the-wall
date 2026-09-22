import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import {
  adminRemoveMark,
  adminResolveReport,
  adminSuspendAccount,
  listModerationActions,
  listReports,
  type ModerationAction,
  type ModerationActionCursor,
  type ReportRow,
} from "@/lib/moderation";
import { runModerationActionFlow, type ModerationTargetAction } from "@/lib/moderation-flow";
import {
  appendUniqueModerationActions,
  groupModerationReports,
  moderationActionLabel,
  moderationActionTarget,
  moderationReportTarget,
  reconcileModerationLoad,
  type ModerationQueueTab,
} from "@/lib/moderation-ui";
import { relativeNotificationTime } from "@/lib/notification-ui";
import { SessionFocusFence, type SessionGenerationToken } from "@/lib/session-generation";
import { colors, markColors, spacing } from "@/theme";

export default function ModerationScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const actorId = session?.user.id ?? null;
  const isAdmin = profile?.is_admin === true;
  const currentActorId = useRef(actorId);
  currentActorId.current = actorId;
  const fence = useRef(new SessionFocusFence());
  const loadInFlight = useRef(false);
  const historyLoadToken = useRef<SessionGenerationToken | null>(null);
  const actionInFlight = useRef(false);
  const [reports, setReports] = useState<readonly ReportRow[]>([]);
  const [actions, setActions] = useState<readonly ModerationAction[]>([]);
  const [nextActionCursor, setNextActionCursor] = useState<ModerationActionCursor | null>(null);
  const [tab, setTab] = useState<ModerationQueueTab>("open");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [olderActionsError, setOlderActionsError] = useState<string | null>(null);
  const [loadingOlderActions, setLoadingOlderActions] = useState(false);

  const load = useCallback(async () => {
    if (!actorId || !isAdmin || loadInFlight.current) {
      setLoading(false);
      return;
    }
    const token = fence.current.begin(actorId);
    if (!token) return;
    historyLoadToken.current = null;
    setLoadingOlderActions(false);
    loadInFlight.current = true;
    setLoading(true);
    setError(null);
    setHistoryError(null);
    try {
      const [openResult, resolvedResult, dismissedResult, actionResult] = await Promise.allSettled([
        listReports(token.userId, "open"),
        listReports(token.userId, "resolved"),
        listReports(token.userId, "dismissed"),
        listModerationActions(token.userId),
      ]);
      const result = reconcileModerationLoad(openResult, resolvedResult, dismissedResult, actionResult);
      if (fence.current.isCurrent(token, currentActorId.current)) {
        setReports(result.reports);
        setActions(result.actionPage.items);
        setNextActionCursor(result.actionPage.nextCursor);
        if (result.historyIncomplete) {
          setHistoryError("Some moderation history couldn't be loaded. The open queue is still available.");
        }
      }
    } catch (cause) {
      if (fence.current.isCurrent(token, currentActorId.current)) {
        setError(cause instanceof Error ? cause.message : "Couldn't load the moderation queue.");
      }
    } finally {
      if (fence.current.isCurrent(token, currentActorId.current)) {
        loadInFlight.current = false;
        setLoading(false);
      }
    }
  }, [actorId, isAdmin]);

  const loadOlderActions = useCallback(async () => {
    if (!actorId || !isAdmin || !nextActionCursor || loadInFlight.current || actionInFlight.current || historyLoadToken.current) return;
    const token = fence.current.begin(actorId);
    if (!token) return;
    historyLoadToken.current = token;
    setLoadingOlderActions(true);
    setOlderActionsError(null);
    try {
      const page = await listModerationActions(token.userId, nextActionCursor);
      if (fence.current.isCurrent(token, currentActorId.current)) {
        setActions((current) => appendUniqueModerationActions(current, page.items));
        setNextActionCursor(page.nextCursor);
      }
    } catch (cause) {
      if (fence.current.isCurrent(token, currentActorId.current)) {
        setOlderActionsError(cause instanceof Error ? cause.message : "Couldn't load older moderation actions.");
      }
    } finally {
      if (historyLoadToken.current === token) {
        historyLoadToken.current = null;
        setLoadingOlderActions(false);
      }
    }
  }, [actorId, isAdmin, nextActionCursor]);

  useFocusEffect(useCallback(() => {
    fence.current.focus(actorId);
    loadInFlight.current = false;
    historyLoadToken.current = null;
    actionInFlight.current = false;
    setReports([]);
    setActions([]);
    setNextActionCursor(null);
    setTab("open");
    setBusyId(null);
    setError(null);
    setHistoryError(null);
    setOlderActionsError(null);
    setLoadingOlderActions(false);
    if (actorId && isAdmin) void load();
    else setLoading(false);
    return () => {
      fence.current.blur();
      loadInFlight.current = false;
      historyLoadToken.current = null;
      actionInFlight.current = false;
    };
  }, [actorId, isAdmin, load]));

  function confirmAction(
    report: ReportRow,
    targetAction: ModerationTargetAction,
    finalStatus: "resolved" | "dismissed",
  ) {
    if (!actorId || actionInFlight.current) return;
    const token = fence.current.begin(actorId);
    if (!token) return;
    const destructive = targetAction !== "none";
    const title = targetAction === "remove_mark"
      ? "Remove this Mark and resolve?"
      : targetAction === "suspend_user"
        ? "Suspend this account and resolve?"
        : finalStatus === "dismissed" ? "Dismiss this report?" : "Resolve this report?";
    Alert.alert(title, destructive
      ? "This target action is immediate. The report will close after it succeeds."
      : "This closes the report without changing the reported target.", [
      { text: "Cancel", style: "cancel" },
      {
        text: targetAction === "suspend_user" ? "Suspend" : targetAction === "remove_mark" ? "Remove" : "Confirm",
        style: destructive ? "destructive" : "default",
        onPress: () => void execute(report, token.userId, token, targetAction, finalStatus),
      },
    ]);
  }

  async function execute(
    report: ReportRow,
    expectedActorId: string,
    token: SessionGenerationToken,
    targetAction: ModerationTargetAction,
    finalStatus: "resolved" | "dismissed",
  ) {
    if (!fence.current.isCurrent(token, currentActorId.current) || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusyId(report.id);
    setError(null);
    const targetId = targetAction === "remove_mark" ? report.mark_id
      : targetAction === "suspend_user" ? report.reported_user_id : null;
    const reason = `Report ${report.id}: ${report.reason}`;
    let completed = false;
    await runModerationActionFlow({
      expectedActorId,
      reportId: report.id,
      targetId,
      targetAction,
      finalStatus,
      reason,
      isCurrent: () => fence.current.isCurrent(token, currentActorId.current),
      removeMark: adminRemoveMark,
      suspendAccount: adminSuspendAccount,
      resolveReport: adminResolveReport,
      onComplete: (reportId) => {
        completed = true;
        setReports((current) => current.filter((item) => item.id !== reportId));
      },
      onError: (cause) => setError(cause instanceof Error ? cause.message : "The moderation action failed."),
      onFinally: () => {
        actionInFlight.current = false;
        setBusyId(null);
        if (completed) void load();
      },
    });
  }

  const groupedReports = groupModerationReports(reports);

  return (
    <Screen dockInset={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        disabled={busyId !== null}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: busyId ? 0.5 : 1 }}
      >
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: 8 }}>Moderation queue</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
        Review open reports. Every target action and report decision is server-authorized and audited.
      </Text>

      {!isAdmin ? (
        <View style={{ marginTop: 28, gap: 12 }}>
          <Text accessibilityRole="alert" variant="headline">This area is available only to administrators.</Text>
          <Button label="Back to settings" variant="ghost" onPress={() => router.replace("/settings")} />
        </View>
      ) : loading ? (
        <ActivityIndicator accessibilityLabel="Loading moderation queue" color={markColors.brandYellow} style={{ marginTop: 36 }} />
      ) : error && reports.length === 0 && actions.length === 0 ? (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text>
          <Button label="Try again" variant="yellow" onPress={() => void load()} />
        </View>
      ) : (
        <View style={{ marginTop: 24, gap: 16 }}>
          {error ? <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text> : null}
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>
            <QueueTab label={`OPEN ${groupedReports.open.length}`} selected={tab === "open"} onPress={() => setTab("open")} />
            <QueueTab label={`CLOSED ${groupedReports.closed.length}`} selected={tab === "closed"} onPress={() => setTab("closed")} />
            <QueueTab label={`AUDIT ${actions.length}${nextActionCursor ? "+" : ""}`} selected={tab === "audit"} onPress={() => setTab("audit")} />
          </View>
          {tab !== "open" && historyError ? (
            <View style={{ gap: 10 }}>
              <Text accessibilityRole="alert" variant="body" color={colors.error}>{historyError}</Text>
              <Button label="Try history again" variant="ghost" onPress={() => void load()} />
            </View>
          ) : null}
          {tab === "open" && groupedReports.open.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text variant="headline">Queue clear</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>There are no open reports.</Text>
            </View>
          ) : null}
          {tab === "open" ? groupedReports.open.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={busyId !== null}
              onAction={(action, status) => confirmAction(report, action, status)}
            />
          )) : null}
          {tab === "closed" && groupedReports.closed.length === 0 && !historyError ? (
            <EmptyHistory label="No closed reports yet." onOpen={() => setTab("open")} />
          ) : null}
          {tab === "closed" ? groupedReports.closed.map((report) => (
            <ClosedReportCard key={report.id} report={report} />
          )) : null}
          {tab === "audit" && actions.length === 0 && !historyError ? (
            <EmptyHistory label="No moderation actions yet." onOpen={() => setTab("open")} />
          ) : null}
          {tab === "audit" ? actions.map((action) => (
            <AuditCard key={action.id} action={action} />
          )) : null}
          {tab === "audit" && olderActionsError ? (
            <Text accessibilityRole="alert" variant="body" color={colors.error}>{olderActionsError}</Text>
          ) : null}
          {tab === "audit" && nextActionCursor ? (
            <Button
              label={loadingOlderActions ? "Loading older actions…" : "Load older actions"}
              variant="ghost"
              disabled={loadingOlderActions || busyId !== null}
              onPress={() => void loadOlderActions()}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function ReportCard({
  report,
  busy,
  onAction,
}: {
  report: ReportRow;
  busy: boolean;
  onAction: (action: ModerationTargetAction, status: "resolved" | "dismissed") => void;
}) {
  const target = moderationReportTarget(report);
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text variant="label">{target} · {report.reason.toUpperCase()}</Text>
        <Text variant="label" color={colors.outline}>{relativeNotificationTime(report.created_at)}</Text>
      </View>
      <Text variant="body" color={colors.onSurfaceVariant}>{report.details?.trim() || "No additional details."}</Text>
      <Text variant="label" color={colors.outline}>REPORT {report.id.slice(0, 8)}</Text>
      <View style={{ gap: spacing.unit * 2 }}>
        {report.mark_id ? (
          <Button label="Remove Mark + resolve" variant="yellow" disabled={busy} onPress={() => onAction("remove_mark", "resolved")} />
        ) : null}
        {report.reported_user_id ? (
          <Button label="Suspend account + resolve" variant="yellow" disabled={busy} onPress={() => onAction("suspend_user", "resolved")} />
        ) : null}
        <Button label="Resolve without target action" variant="ghost" disabled={busy} onPress={() => onAction("none", "resolved")} />
        <Button label="Dismiss report" variant="ghost" disabled={busy} onPress={() => onAction("none", "dismissed")} />
      </View>
    </View>
  );
}

function QueueTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: selected ? markColors.brandYellow : colors.surface,
      }}
    >
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

function EmptyHistory({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <View style={{ paddingVertical: 36, gap: 12 }}>
      <Text variant="headline" style={{ textAlign: "center" }}>{label}</Text>
      <Button label="View open queue" variant="ghost" onPress={onOpen} />
    </View>
  );
}

function ClosedReportCard({ report }: { report: ReportRow }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.outlineVariant, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text variant="label">{moderationReportTarget(report)} · {report.status.toUpperCase()}</Text>
        <Text variant="label" color={colors.outline}>{relativeNotificationTime(report.resolved_at ?? report.created_at)}</Text>
      </View>
      <Text variant="body">{report.reason.replaceAll("_", " ")}</Text>
      <Text variant="body" color={colors.onSurfaceVariant}>{report.details?.trim() || "No additional details."}</Text>
      <Text variant="label" color={colors.outline}>REPORT {report.id.slice(0, 8)}</Text>
    </View>
  );
}

function AuditCard({ action }: { action: ModerationAction }) {
  return (
    <View style={{ backgroundColor: colors.surfaceContainerLow, borderWidth: 1.5, borderColor: colors.ink, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text variant="headline">{moderationActionLabel(action.action)}</Text>
        <Text variant="label" color={colors.outline}>{relativeNotificationTime(action.created_at)}</Text>
      </View>
      <Text variant="label">{moderationActionTarget(action)}</Text>
      {action.reason?.trim() ? <Text variant="body" color={colors.onSurfaceVariant}>{action.reason.trim()}</Text> : null}
    </View>
  );
}
