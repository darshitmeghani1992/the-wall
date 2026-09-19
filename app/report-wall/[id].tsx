import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { ReportReasonForm } from "@/components/ReportReasonForm";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { TargetRouteFence } from "@/lib/relationship-ui";
import { createReport, type ReportReason } from "@/lib/reports";
import { SessionFocusFence } from "@/lib/session-generation";
import { getWall, getWallCapabilities } from "@/lib/walls";
import { colors, markColors } from "@/theme";

export default function ReportSharedWallScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const wallId = typeof id === "string" ? id : null;
  const [wallName, setWallName] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentActorId = useRef(actorId);
  const currentWallId = useRef(wallId);
  const subjectFence = useRef(new SessionFocusFence());
  const targetFence = useRef(new TargetRouteFence());
  const submissionInFlight = useRef(false);
  currentActorId.current = actorId;
  currentWallId.current = wallId;

  const load = useCallback(async () => {
    if (!actorId || !wallId) {
      setLoading(false);
      setError("This Shared Wall isn't available.");
      return;
    }
    const subjectToken = subjectFence.current.begin(actorId);
    const targetToken = targetFence.current.capture(wallId);
    if (!subjectToken || !targetToken) {
      setLoading(false);
      setError("This Shared Wall isn't available.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [wall, capabilities] = await Promise.all([
        getWall(targetToken.targetId),
        getWallCapabilities(targetToken.targetId),
      ]);
      if (!subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        || !targetFence.current.isCurrent(targetToken, currentWallId.current)) return;
      if (!wall || wall.type !== "shared" || capabilities?.wallType !== "shared") {
        setError("This Shared Wall isn't available.");
        return;
      }
      if (capabilities.joinState === "owner") {
        setError("You can't report a Shared Wall you own.");
        return;
      }
      setWallName(wall.name);
    } catch (cause) {
      if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentWallId.current)) {
        setError(cause instanceof Error ? cause.message : "Couldn't open this report form.");
      }
    } finally {
      if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentWallId.current)) setLoading(false);
    }
  }, [actorId, wallId]);

  useFocusEffect(useCallback(() => {
    subjectFence.current.focus(actorId);
    targetFence.current.focus(wallId);
    submissionInFlight.current = false;
    setWallName(null);
    setReason(null);
    setDetails("");
    setReportSubmitted(false);
    setBusy(false);
    if (actorId && wallId) void load();
    else {
      setLoading(false);
      setError("You need to be signed in to report a Shared Wall.");
    }
    return () => {
      subjectFence.current.blur();
      targetFence.current.blur();
    };
  }, [actorId, load, wallId]));

  async function submit() {
    if (!actorId || !wallId || !wallName || !reason || submissionInFlight.current) return;
    const subjectToken = subjectFence.current.begin(actorId);
    const targetToken = targetFence.current.capture(wallId);
    if (!subjectToken || !targetToken) return;
    const submittedReason = reason;
    const submittedDetails = details;
    submissionInFlight.current = true;
    setBusy(true);
    try {
      await createReport(subjectToken.userId, {
        wallId: targetToken.targetId,
        reason: submittedReason,
        details: submittedDetails,
      });
      if (!subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        || !targetFence.current.isCurrent(targetToken, currentWallId.current)) return;
      setReportSubmitted(true);
      Alert.alert(
        "Report received",
        "Thanks. We’ll review this Shared Wall and take action if needed.",
        [{
          text: "Done",
          onPress: () => {
            if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
              && targetFence.current.isCurrent(targetToken, currentWallId.current)) router.back();
          },
        }],
      );
    } catch (cause) {
      if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentWallId.current)) {
        Alert.alert(
          "Couldn't send report",
          cause instanceof Error ? cause.message : "Please try again.",
        );
      }
    } finally {
      if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentWallId.current)) {
        submissionInFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <Screen dockInset={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ fontSize: 28, marginTop: 8 }}>Report Shared Wall</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 20 }}>
        {wallName
          ? `Tell us what is wrong with “${wallName}”. Your report is private.`
          : "Tell us what is wrong. Your report is private."}
      </Text>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 36 }} />
      ) : error ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text>
          <Button label="Try again" variant="yellow" onPress={() => void load()} />
        </View>
      ) : (
        <>
          <ReportReasonForm
            reason={reason}
            details={details}
            disabled={busy || reportSubmitted}
            onReasonChange={setReason}
            onDetailsChange={setDetails}
          />
          <View style={{ marginTop: 22 }}>
            <Button
              label={reportSubmitted ? "Report submitted" : "Submit report"}
              variant="primary"
              loading={busy}
              disabled={!reason || !wallName || reportSubmitted}
              onPress={() => void submit()}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
