import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { getCurrentAccountDeletion, reactivateAccount } from "@/lib/account";
import type { CurrentAccountDeletion } from "@/lib/account-deletion-contract";
import { runAccountRecoveryFlow } from "@/lib/account-recovery-flow";
import { useAuth } from "@/lib/auth";
import { AccountRouteFence } from "@/lib/onboarding-contract";
import { colors } from "@/theme";

export default function AccountRecovery() {
  const router = useRouter();
  const { session, accountRoute, refreshAccountRoute, signOut } = useAuth();
  const userId = session?.user.id ?? null;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const fence = useRef(new AccountRouteFence());
  const [busy, setBusy] = useState(false);
  const [deletion, setDeletion] = useState<CurrentAccountDeletion | null>(null);
  const [deletionStatusUnavailable, setDeletionStatusUnavailable] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const currentFence = fence.current;
    return () => currentFence.invalidate(currentUserId.current);
  }, [userId]);

  useEffect(() => {
    if (accountRoute && accountRoute !== "deactivated" && !inFlight.current) router.replace("/");
  }, [accountRoute, router]);

  useEffect(() => {
    let current = true;
    setDeletion(null);
    setDeletionStatusUnavailable(false);
    if (!userId || accountRoute !== "deactivated") return () => { current = false; };
    void getCurrentAccountDeletion()
      .then((result) => { if (current && currentUserId.current === userId) setDeletion(result); })
      .catch(() => {
        if (current && currentUserId.current === userId) setDeletionStatusUnavailable(true);
      });
    return () => { current = false; };
  }, [accountRoute, userId]);

  async function restore() {
    if (!userId || inFlight.current) return;
    const token = fence.current.begin(userId);
    inFlight.current = true;
    setBusy(true);
    await runAccountRecoveryFlow({
      expectedActorId: userId,
      isCurrent: () => fence.current.isCurrent(token, currentUserId.current),
      reactivate: reactivateAccount,
      refreshAccountRoute,
      navigateToCanonicalGate: () => router.replace("/"),
      onError: (cause) => Alert.alert(
        "Couldn't restore your account",
        cause instanceof Error ? cause.message : "Please try again.",
      ),
      onFinally: () => {
        inFlight.current = false;
        setBusy(false);
      },
    });
  }

  if (accountRoute && accountRoute !== "deactivated" && !inFlight.current) {
    return <Redirect href="/" />;
  }

  return (
    <Screen scroll={false} dockInset={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Text variant="label" color={colors.outline}>
          {deletion?.status === "scheduled" ? "DELETION SCHEDULED" : "WELCOME BACK"}
        </Text>
        <Text variant="display" style={{ fontSize: 32 }}>
          {deletion?.status === "scheduled" ? "Your account is scheduled for deletion." : "Your Wall is paused."}
        </Text>
        <Text variant="body" color={colors.onSurfaceVariant}>
          {deletion?.status === "scheduled"
            ? `Restore your account before ${new Date(deletion.purgeAfter).toLocaleDateString()} to cancel permanent deletion.`
            : deletionStatusUnavailable
              ? "Restore your account to return to your Wall and cancel any pending deletion."
              : "Restore your account to return to your Wall and connections."}
        </Text>
      </View>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Button
          label={deletion?.status === "scheduled" ? "Cancel deletion and restore" : "Restore my account"}
          variant="yellow"
          loading={busy}
          onPress={() => void restore()}
        />
        <Button label="Sign out" variant="ghost" disabled={busy} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
