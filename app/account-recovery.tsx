import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { reactivateAccount } from "@/lib/account";
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
  const inFlight = useRef(false);

  useEffect(() => {
    const currentFence = fence.current;
    if (accountRoute && accountRoute !== "deactivated" && !inFlight.current) router.replace("/");
    return () => currentFence.invalidate(currentUserId.current);
  }, [accountRoute, router]);

  async function restore() {
    if (!userId || inFlight.current) return;
    const token = fence.current.begin(userId);
    inFlight.current = true;
    setBusy(true);
    try {
      await reactivateAccount(userId);
      if (!fence.current.isCurrent(token, currentUserId.current)) return;
      await refreshAccountRoute();
      if (currentUserId.current === userId) router.replace("/");
    } catch (cause: any) {
      if (currentUserId.current === userId) Alert.alert("Couldn't restore your account", cause?.message ?? "Please try again.");
    } finally {
      if (currentUserId.current === userId) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  if (accountRoute && accountRoute !== "deactivated" && !inFlight.current) {
    return <Redirect href="/" />;
  }

  return (
    <Screen scroll={false} dockInset={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Text variant="label" color={colors.outline}>WELCOME BACK</Text>
        <Text variant="display" style={{ fontSize: 32 }}>Your Wall is paused.</Text>
        <Text variant="body" color={colors.onSurfaceVariant}>Restore your account to return to your Wall and connections.</Text>
      </View>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Button label="Restore my account" variant="yellow" loading={busy} onPress={() => void restore()} />
        <Button label="Sign out" variant="ghost" disabled={busy} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
