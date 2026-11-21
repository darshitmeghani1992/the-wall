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
import { unavailableLinkSubjectKey } from "@/lib/unavailable-link-scope";
import { colors, markColors } from "@/theme";

type ClaimedUnavailable = { subjectKey: string; token: DeferredAttemptToken | null };

export default function DeferredDestinationUnavailable() {
  const router = useRouter();
  const { __deferred_ref: rawReference } = useLocalSearchParams<{ __deferred_ref?: string }>();
  const { loading, session, accountRoute } = useAuth();
  const reference = typeof rawReference === "string" ? rawReference : null;
  const actorId = session?.user.id ?? null;
  const subjectKey = unavailableLinkSubjectKey(actorId, reference, accountRoute === "ready");
  const [claimed, setClaimed] = useState<ClaimedUnavailable | null>(null);
  const claimedSubject = useRef<string | null>(null);

  useEffect(() => {
    if (!subjectKey || !reference || !actorId) {
      claimedSubject.current = null;
      setClaimed(null);
      return;
    }
    if (claimedSubject.current === subjectKey) return;
    claimedSubject.current = subjectKey;
    setClaimed({
      subjectKey,
      token: claimDeferredAttemptReference(
        reference as DeferredNavigationRef,
        { kind: "unavailable" },
        actorId,
      ),
    });
  }, [actorId, reference, subjectKey]);

  useEffect(() => {
    if (claimed?.subjectKey === subjectKey && claimed.token) void acknowledgeDeferredUnavailable(claimed.token);
  }, [claimed, subjectKey]);

  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} /></Screen>;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Screen><ActivityIndicator color={markColors.brandYellow} /></Screen>;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;
  // Never acknowledge or display an expired/unrelated actor's claimed reference.
  if (!subjectKey) return <Redirect href="/(tabs)/home" />;
  if (claimed?.subjectKey !== subjectKey) return <Screen><ActivityIndicator color={markColors.brandYellow} /></Screen>;
  if (!claimed.token) return <Redirect href="/(tabs)/home" />;

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
