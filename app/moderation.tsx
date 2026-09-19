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
  listReports,
  type ReportRow,
} from "@/lib/moderation";
import { runModerationActionFlow, type ModerationTargetAction } from "@/lib/moderation-flow";
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
  const actionInFlight = useRef(false);
  const [reports, setReports] = useState<readonly ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!actorId || !isAdmin || loadInFlight.current) {
      setLoading(false);
      return;
    }
    const token = fence.current.begin(actorId);
    if (!token) return;
    loadInFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const rows = await listReports(token.userId, "open");
      if (fence.current.isCurrent(token, currentActorId.current)) setReports(rows);
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

  useFocusEffect(useCallback(() => {
    fence.current.focus(actorId);
    loadInFlight.current = false;
    actionInFlight.current = false;
    setReports([]);
    setBusyId(null);
    setError(null);
    if (actorId && isAdmin) void load();
    else setLoading(false);
    return () => {
      fence.current.blur();
      loadInFlight.current = false;
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
      onComplete: (reportId) => setReports((current) => current.filter((item) => item.id !== reportId)),
      onError: (cause) => setError(cause instanceof Error ? cause.message : "The moderation action failed."),
      onFinally: () => {
        actionInFlight.current = false;
        setBusyId(null);
      },
    });
  }

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
      ) : error && reports.length === 0 ? (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text>
          <Button label="Try again" variant="yellow" onPress={() => void load()} />
        </View>
      ) : (
        <View style={{ marginTop: 24, gap: 16 }}>
          {error ? <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text> : null}
          {reports.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text variant="headline">Queue clear</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>There are no open reports.</Text>
            </View>
          ) : reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={busyId !== null}
              onAction={(action, status) => confirmAction(report, action, status)}
            />
          ))}
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
  const target = report.mark_id ? "MARK" : report.reported_user_id ? "ACCOUNT" : "SHARED WALL";
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
