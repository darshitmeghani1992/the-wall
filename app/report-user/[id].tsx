import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";
import { TargetRouteFence } from "@/lib/relationship-ui";
import { createReport, REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, radius } from "@/theme";

export default function ReportUserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const targetId = typeof id === "string" ? id : null;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
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
    try {
      await createReport(subjectToken.userId, {
        userId: targetToken.targetId,
        reason: submittedReason,
        details: submittedDetails,
      });
      if (!subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        || !targetFence.current.isCurrent(targetToken, currentTargetId.current)) return;
      Alert.alert("Report received", "Thanks. We’ll review it and take action if needed.", [
        {
          text: "Done",
          onPress: () => {
            if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
              && targetFence.current.isCurrent(targetToken, currentTargetId.current)) router.back();
          },
        },
      ]);
    } catch (cause: any) {
      if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentTargetId.current)) {
        Alert.alert("Couldn't send report", cause?.message ?? "Please try again.");
      }
    } finally {
      if (subjectFence.current.isCurrent(subjectToken, currentActorId.current)
        && targetFence.current.isCurrent(targetToken, currentTargetId.current)) {
        submissionInFlight.current = false;
        setBusy(false);
      }
    }
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
      <View style={{ gap: 8 }}>
        {REPORT_REASONS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === item }}
            onPress={() => setReason(item)}
            style={{ borderWidth: reason === item ? 2 : 1, borderColor: colors.ink, borderRadius: radius.card, padding: 14 }}
          >
            <Text variant="headline">{REPORT_REASON_LABELS[item]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 18 }}>
        <Input label="DETAILS · OPTIONAL" value={details} onChangeText={setDetails} multiline maxLength={500} placeholder="Tell us what happened" />
      </View>
      <View style={{ marginTop: 22 }}>
        <Button label="Submit report" variant="primary" loading={busy} disabled={!reason || !actorId || !targetId} onPress={submit} />
      </View>
    </Screen>
  );
}
