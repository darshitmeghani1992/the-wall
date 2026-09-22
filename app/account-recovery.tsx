import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { getCurrentAccountDeletion, reactivateAccount } from "@/lib/account";
import {
  canOfferAccountRecovery,
  type AccountDeletionStatusLoadState,
  type CurrentAccountDeletion,
} from "@/lib/account-deletion-contract";
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
  const [statusLoadState, setStatusLoadState] = useState<AccountDeletionStatusLoadState>("loading");
  const [statusRequest, setStatusRequest] = useState(0);
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
    setStatusLoadState("loading");
    if (!userId || accountRoute !== "deactivated") return () => { current = false; };
    void getCurrentAccountDeletion()
      .then((result) => {
        if (current && currentUserId.current === userId) {
          setDeletion(result);
          setStatusLoadState("ready");
        }
      })
      .catch(() => {
        if (current && currentUserId.current === userId) setStatusLoadState("error");
      });
    return () => { current = false; };
  }, [accountRoute, statusRequest, userId]);

  async function restore() {
    if (!userId || !canOfferAccountRecovery(statusLoadState, deletion) || inFlight.current) return;
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
          {statusLoadState === "loading" ? "CHECKING ACCOUNT"
            : statusLoadState === "error" ? "STATUS UNAVAILABLE"
            : deletion?.status === "expired"
            ? "RECOVERY WINDOW ENDED"
            : deletion?.status === "scheduled" ? "DELETION SCHEDULED" : "WELCOME BACK"}
        </Text>
        <Text variant="display" style={{ fontSize: 32 }}>
          {statusLoadState === "loading" ? "Checking your recovery window…"
            : statusLoadState === "error" ? "We couldn't verify your account status."
            : deletion?.status === "expired"
            ? "Your account is awaiting permanent deletion."
            : deletion?.status === "scheduled" ? "Your account is scheduled for deletion." : "Your Wall is paused."}
        </Text>
        <Text variant="body" color={colors.onSurfaceVariant}>
          {statusLoadState === "loading" ? "Restoration will be available only after the server confirms your status."
            : statusLoadState === "error" ? "Try the status check again. You can also sign out and return later."
            : deletion?.status === "expired"
            ? "The server-confirmed recovery deadline has passed. Restoration is no longer available."
            : deletion?.status === "scheduled"
            ? `Restore your account before ${new Date(deletion.purgeAfter).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" })} to cancel permanent deletion.`
            : "Restore your account to return to your Wall and connections."}
        </Text>
      </View>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {canOfferAccountRecovery(statusLoadState, deletion) ? (
          <Button
            label={deletion?.status === "scheduled" ? "Cancel deletion and restore" : "Restore my account"}
            variant="yellow"
            loading={busy}
            onPress={() => void restore()}
          />
        ) : null}
        {statusLoadState === "loading" ? (
          <Button label="Checking recovery status" variant="yellow" loading disabled />
        ) : null}
        {statusLoadState === "error" ? (
          <Button
            label="Retry status check"
            variant="yellow"
            disabled={busy}
            onPress={() => setStatusRequest((value) => value + 1)}
          />
        ) : null}
        <Button label="Sign out" variant="ghost" disabled={busy} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
