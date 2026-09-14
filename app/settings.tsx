import { Alert, Pressable, View } from "react-native";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { deactivateAccount } from "@/lib/account";
import { SessionFocusFence } from "@/lib/session-generation";
import { runSettingsDeactivationFlow } from "@/components/safety-action-flows";
import { colors } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { session, profile, refreshAccountRoute, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const actorId = session?.user.id ?? null;
  const currentActorId = useRef(actorId);
  const actionFence = useRef(new SessionFocusFence());
  const actionInFlight = useRef(false);
  currentActorId.current = actorId;

  useFocusEffect(useCallback(() => {
    actionFence.current.focus(actorId);
    actionInFlight.current = false;
    setBusy(false);
    return () => actionFence.current.blur();
  }, [actorId]));

  function confirmDeactivate() {
    if (!actorId || actionInFlight.current) return;
    const subjectToken = actionFence.current.begin(actorId);
    if (!subjectToken) return;
    Alert.alert(
      "Deactivate your account?",
      "Your profile and Walls will stop being discoverable or interactable. You can sign back in and reactivate during the recovery window.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            if (!actionFence.current.isCurrent(subjectToken, currentActorId.current)
              || actionInFlight.current) return;
            actionInFlight.current = true;
            setBusy(true);
            await runSettingsDeactivationFlow({
              expectedActorId: subjectToken.userId,
              isCurrent: () => actionFence.current.isCurrent(subjectToken, currentActorId.current),
              deactivate: deactivateAccount,
              refreshAccountRoute,
              navigateToCanonicalGate: () => router.replace("/"),
              onError: (cause) => Alert.alert(
                "Couldn't deactivate",
                cause instanceof Error ? cause.message : "Please try again.",
              ),
              onFinally: () => {
                actionInFlight.current = false;
                setBusy(false);
              },
            });
          },
        },
      ],
    );
  }

  return (
    <Screen dockInset={false}>
      <Pressable
        onPress={() => { if (!actionInFlight.current) router.back(); }}
        disabled={busy}
        hitSlop={10}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: busy ? 0.5 : 1 }}
      >
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: 8 }}>Settings</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 26 }}>
        Manage your profile session and account lifecycle.
      </Text>

      <View style={{ gap: 12 }}>
        <Button label="Edit profile" variant="ghost" disabled={busy} onPress={() => router.push("/profile-edit")} />
        <Button label="Sign out" variant="primary" disabled={busy} onPress={signOut} />
      </View>

      <View style={{ marginTop: 34, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 20 }}>
        <Text variant="label" color={colors.error}>ACCOUNT</Text>
        <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8, marginBottom: 12 }}>
          Deactivation is recoverable. Your existing content is preserved while your account is inactive.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !actorId || profile?.account_status !== "active"}
          onPress={confirmDeactivate}
          style={{ minHeight: 48, justifyContent: "center", opacity: busy ? 0.5 : 1 }}
        >
          <Text variant="label" color={colors.error}>DEACTIVATE ACCOUNT</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
