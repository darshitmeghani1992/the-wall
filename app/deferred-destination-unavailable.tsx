import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { acknowledgeDeferredUnavailable, claimDeferredAttemptReference } from "@/lib/deferred-destination";
import type { DeferredAttemptToken, DeferredNavigationRef } from "@/lib/deferred-destination-contract";
import { destinationForAccountRoute } from "@/lib/onboarding-contract";
import { colors, markColors } from "@/theme";

export default function DeferredDestinationUnavailable() {
  const router = useRouter();
  const { __deferred_ref: rawReference } = useLocalSearchParams<{ __deferred_ref?: string }>();
  const { loading, session, accountRoute } = useAuth();
  const [token, setToken] = useState<DeferredAttemptToken | null>(null);
  const claimedReference = useRef<string | null>(null);

  useEffect(() => {
    const reference = typeof rawReference === "string" ? rawReference : null;
    const subject = session?.user.id;
    if (!subject || accountRoute !== "ready" || !reference || claimedReference.current === reference) return;
    claimedReference.current = reference;
    setToken(claimDeferredAttemptReference(
      reference as DeferredNavigationRef,
      { kind: "unavailable" },
      subject,
    ));
  }, [accountRoute, rawReference, session?.user.id]);

  useEffect(() => {
    if (token) void acknowledgeDeferredUnavailable(token);
  }, [token]);

  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} /></Screen>;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Screen><ActivityIndicator color={markColors.brandYellow} /></Screen>;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;
  if (!token) {
    if (claimedReference.current) return <Redirect href="/(tabs)/home" />;
    return <Screen><ActivityIndicator color={markColors.brandYellow} /></Screen>;
  }

  return (
    <Screen dockInset={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 14 }} accessibilityRole="alert">
        <Text variant="display" style={{ fontSize: 30 }}>This isn&apos;t available anymore.</Text>
        <Text variant="body" color={colors.onSurfaceVariant}>
          It may have been removed, or this account may not have access.
        </Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button label="My Wall" variant="yellow" onPress={() => router.replace("/(tabs)/home")} />
          <Button label="Discover" variant="primary" onPress={() => router.replace("/(tabs)/discover")} />
        </View>
      </View>
    </Screen>
  );
}
