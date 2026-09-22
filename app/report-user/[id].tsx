import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { ReportReasonForm } from "@/components/ReportReasonForm";
import { useAuth } from "@/lib/auth";
import { blockUser } from "@/lib/blocks";
import { TargetRouteFence } from "@/lib/relationship-ui";
import { createReport, type ReportReason } from "@/lib/reports";
import { runUserReportFlow } from "@/lib/reporting-flow";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, markColors } from "@/theme";

export default function ReportUserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const targetId = typeof id === "string" ? id : null;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentActorId = useRef(actorId);
  const currentTargetId = useRef(targetId);
  const subjectFence = useRef(new SessionFocusFence());
  const targetFence = useRef(new TargetRouteFence());
  const submissionInFlight = useRef(false);
  currentActorId.current = actorId;
  currentTargetId.current = targetId;

  useFocusEffect(useCallback(() => {
    subjectFence.current.focus(actorId);
    targetFence.current.focus(targetId);
    submissionInFlight.current = false;
    setBusy(false);
    setReason(null);
    setDetails("");
    setAlsoBlock(false);
    setReportSubmitted(false);
    return () => {
      subjectFence.current.blur();
      targetFence.current.blur();
    };
  }, [actorId, targetId]));

  async function submit() {
    if (!actorId || !targetId || !reason || submissionInFlight.current) return;
    const subjectToken = subjectFence.current.begin(actorId);
    const targetToken = targetFence.current.capture(targetId);
    if (!subjectToken || !targetToken) return;
    const submittedReason = reason;
    const submittedDetails = details;
    submissionInFlight.current = true;
    setBusy(true);
    const blockAfterReport = alsoBlock;
    await runUserReportFlow({
      expectedActorId: subjectToken.userId,
      targetUserId: targetToken.targetId,
      reason: submittedReason,
      details: submittedDetails,
      alreadyReported: reportSubmitted,
      blockAfterReport,
      isCurrent: () => subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentTargetId.current),
      createReport,
      blockUser,
      onReportSubmitted: () => setReportSubmitted(true),
      onComplete: (blocked) => Alert.alert(
        "Report received",
        blocked
          ? "Thanks. We’ll review the report, and this person is now blocked."
          : "Thanks. We’ll review it and take action if needed.",
        [{
          text: "Done",
          onPress: () => {
            if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
              && targetFence.current.isCurrent(targetToken, currentTargetId.current)) router.back();
          },
        }],
      ),
      onBlockError: () => Alert.alert(
        "Report received",
        "The report was sent, but we couldn't block this person. Try blocking again.",
      ),
      onError: (cause) => Alert.alert(
        "Couldn't send report",
        cause instanceof Error ? cause.message : "Please try again.",
      ),
      onFinally: () => {
        submissionInFlight.current = false;
        setBusy(false);
      },
    });
  }

  return (
    <Screen dockInset={false}>
      <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ fontSize: 28, marginTop: 8 }}>Report this person</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 20 }}>
        Choose the reason that best describes the problem. Reports are sent to moderation.
      </Text>
      <ReportReasonForm
        reason={reason}
        details={details}
        disabled={busy || reportSubmitted}
        onReasonChange={setReason}
        onDetailsChange={setDetails}
      />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Also block this person</Text>
          <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 3 }}>
            You won&apos;t be able to find or interact with each other.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Also block this person"
          value={alsoBlock}
          disabled={busy || reportSubmitted}
          onValueChange={setAlsoBlock}
          trackColor={{ false: colors.outlineVariant, true: markColors.brandYellow }}
          thumbColor={colors.ink}
        />
      </View>
      <View style={{ marginTop: 22 }}>
        <Button
          label={reportSubmitted ? "Retry blocking" : alsoBlock ? "Submit report & block" : "Submit report"}
          variant="primary"
          loading={busy}
          disabled={!reason || !actorId || !targetId || (reportSubmitted && !alsoBlock)}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}
