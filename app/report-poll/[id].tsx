import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { ReportReasonForm } from "@/components/ReportReasonForm";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { getFocusedWallMark } from "@/lib/poll-detail-service";
import { createReport, type ReportReason } from "@/lib/reports";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, markColors } from "@/theme";

/** Poll reporting targets a private Poll ID, never the legacy marks table. */
export default function ReportPollScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; wallId?: string | string[] }>();
  const pollId = typeof params.id === "string" ? params.id : null;
  const wallId = typeof params.wallId === "string" ? params.wallId : null;
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const subject = actorId && wallId && pollId ? [actorId, wallId, pollId].join(":") : null;
  const currentSubject = useRef(subject);
  currentSubject.current = subject;
  const fence = useRef(new SessionFocusFence());
  const inFlight = useRef(false);
  const [loadedSubject, setLoadedSubject] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const ready = subject !== null && subject === loadedSubject && available;

  const load = useCallback(async () => {
    if (!actorId || !wallId || !pollId || !subject) {
      setLoadedSubject(null);
      setAvailable(false);
      setLoading(false);
      return;
    }
    const token = fence.current.begin(actorId);
    if (!token) return;
    setLoadedSubject(null);
    setAvailable(false);
    setError(null);
    setLoading(true);
    try {
      const result = await getFocusedWallMark(token.userId, wallId, pollId);
      if (!fence.current.isCurrent(token, currentSubject.current?.split(":")[0] ?? null)
        || currentSubject.current !== subject) return;
      setAvailable(result?.kind === "poll");
      setLoadedSubject(subject);
    } catch {
      if (fence.current.isCurrent(token, currentSubject.current?.split(":")[0] ?? null)
        && currentSubject.current === subject) {
        setError("Couldn’t verify this Poll. Please try again.");
        setLoadedSubject(subject);
      }
    } finally {
      if (fence.current.isCurrent(token, currentSubject.current?.split(":")[0] ?? null)
        && currentSubject.current === subject) setLoading(false);
    }
  }, [actorId, wallId, pollId, subject]);

  useFocusEffect(useCallback(() => {
    fence.current.focus(actorId);
    inFlight.current = false;
    setLoadedSubject(null);
    setAvailable(false);
    setReason(null);
    setDetails("");
    setSubmitted(false);
    setBusy(false);
    void load();
    return () => { fence.current.blur(); inFlight.current = false; };
  }, [actorId, load]));

  async function submit() {
    if (!actorId || !pollId || !subject || !ready || !reason
      || submitted || inFlight.current || currentSubject.current !== subject) return;
    const token = fence.current.begin(actorId);
    if (!token) return;
    const reasonToSend = reason;
    const detailsToSend = details;
    inFlight.current = true;
    setBusy(true);
    try {
      await createReport(token.userId, { pollId, reason: reasonToSend, details: detailsToSend });
      if (!fence.current.isCurrent(token, actorId) || currentSubject.current !== subject) return;
      setSubmitted(true);
      Alert.alert("Report received", "We’ll review this Poll.", [
        { text: "Done", onPress: () => {
          if (fence.current.isCurrent(token, actorId) && currentSubject.current === subject) router.back();
        } },
      ]);
    } catch {
      if (fence.current.isCurrent(token, actorId) && currentSubject.current === subject)
        Alert.alert("Couldn’t send report", "Check your connection and try again.");
    } finally {
      if (fence.current.isCurrent(token, actorId) && currentSubject.current === subject) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <Screen dockInset={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={busy}
        onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: 8 }}>Report Poll</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginVertical: 14 }}>
        Your report is private. Select a reason so moderators can review it.
      </Text>
      {loading || (subject !== null && loadedSubject !== subject) ? (
        <ActivityIndicator accessibilityLabel="Checking Poll" color={markColors.brandYellow} />
      ) : !ready ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert">{error ?? "This Poll isn’t available to report."}</Text>
          {error ? <Button label="Try again" onPress={() => void load()} /> : null}
        </View>
      ) : (
        <View>
          <ReportReasonForm reason={reason} details={details} disabled={busy || submitted}
            onReasonChange={setReason} onDetailsChange={setDetails} />
          <View style={{ marginTop: 20 }}>
            <Button label={submitted ? "Report submitted" : "Submit report"} loading={busy}
              disabled={!reason || submitted || busy} onPress={() => void submit()} />
          </View>
        </View>
      )}
    </Screen>
  );
}
