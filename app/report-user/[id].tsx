import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { createReport, REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports";
import { colors, radius } from "@/theme";

export default function ReportUserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!id || !reason || busy) return;
    setBusy(true);
    try {
      await createReport({ userId: id, reason, details });
      Alert.alert("Report received", "Thanks. We’ll review it and take action if needed.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (cause: any) {
      Alert.alert("Couldn't send report", cause?.message ?? "Please try again.");
      setBusy(false);
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
        <Button label="Submit report" variant="primary" loading={busy} disabled={!reason} onPress={submit} />
      </View>
    </Screen>
  );
}
