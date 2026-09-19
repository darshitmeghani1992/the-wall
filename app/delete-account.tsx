import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { requestAccountDeletion } from "@/lib/account";
import { reconcileCommittedDeletion } from "@/lib/account-deletion-contract";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, radius, spacing } from "@/theme";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { session, refreshAccountRoute } = useAuth();
  const actorId = session?.user.id ?? null;
  const currentActorId = useRef(actorId);
  const actionFence = useRef(new SessionFocusFence());
  const inFlight = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  currentActorId.current = actorId;

  useFocusEffect(useCallback(() => {
    actionFence.current.focus(actorId);
    inFlight.current = false;
    setBusy(false);
    return () => actionFence.current.blur();
  }, [actorId]));

  async function scheduleDeletion() {
    if (!actorId || confirmation !== "DELETE" || inFlight.current) return;
    const token = actionFence.current.begin(actorId);
    if (!token) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await requestAccountDeletion(token.userId, confirmation);
      if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
      if (result.status === "owner_action_required") {
        const noun = result.ownedSharedWallCount === 1 ? "Shared Wall" : "Shared Walls";
        Alert.alert(
          "Resolve Shared Wall ownership",
          `You still own ${result.ownedSharedWallCount} ${noun}. Transfer each one to an active member or delete it before deleting your account.`,
          [
            { text: "Not now", style: "cancel" },
            { text: "Review my Walls", onPress: () => router.replace("/(tabs)/home") },
          ],
        );
        return;
      }
      if (result.status === "invalid_confirmation") {
        Alert.alert("Type DELETE exactly", "Account deletion was not scheduled.");
        return;
      }
      if (result.status === "unavailable") {
        Alert.alert("Deletion unavailable", "Your account cannot be scheduled for deletion right now.");
        return;
      }
      const reconciliation = await reconcileCommittedDeletion({
        isCurrent: () => actionFence.current.isCurrent(token, currentActorId.current),
        refreshAccountRoute,
        navigateToCanonicalGate: () => router.replace("/"),
      });
      if (reconciliation.status === "refresh_failed") {
        Alert.alert(
          "Deletion scheduled",
          "Your account is paused and the 30-day recovery period has started. We couldn't refresh this screen, so sign in again if the recovery screen does not appear.",
        );
      }
    } catch (cause) {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        Alert.alert(
          "Couldn't schedule deletion",
          cause instanceof Error ? cause.message : "Please try again.",
        );
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        inFlight.current = false;
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
        hitSlop={10}
        onPress={() => { if (!inFlight.current) router.back(); }}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: busy ? 0.5 : 1 }}
      >
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>

      <Text variant="display" style={{ marginTop: 8 }}>Delete account</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
        Your account will be paused immediately. You can restore it for 30 days; after that, deletion is permanent.
      </Text>

      <View style={{ marginTop: 24, gap: 12, padding: 18, borderWidth: 2, borderColor: colors.error, borderRadius: radius.card }}>
        <Text variant="headline" color={colors.error}>This permanently deletes:</Text>
        <Text variant="body">• Your profile, Personal Wall, avatar, and connections</Text>
        <Text variant="body">• Every Mark you authored, including Marks on other Walls</Text>
        <Text variant="body">• Every Mark and media item on your Personal Wall</Text>
        <Text variant="body">• Memberships, notifications, and related personal data</Text>
      </View>

      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 20 }}>
        Shared Walls are never silently erased. Transfer or delete every Shared Wall you own before scheduling deletion.
      </Text>

      <Text variant="label" style={{ marginTop: 28, marginBottom: 8 }}>TYPE DELETE TO CONFIRM</Text>
      <TextInput
        accessibilityLabel="Type DELETE to confirm account deletion"
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!busy}
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="DELETE"
        placeholderTextColor={colors.outline}
        style={{
          minHeight: 52,
          paddingHorizontal: spacing.gutter,
          borderWidth: 2,
          borderColor: confirmation === "DELETE" ? colors.error : colors.outline,
          borderRadius: radius.card,
          color: colors.ink,
          backgroundColor: colors.surface,
          fontSize: 17,
        }}
      />

      <View style={{ marginTop: 22, gap: 12 }}>
        <Button
          label="Schedule account deletion"
          loading={busy}
          disabled={!actorId || confirmation !== "DELETE"}
          onPress={() => void scheduleDeletion()}
        />
        <Button label="Keep my account" variant="ghost" disabled={busy} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
