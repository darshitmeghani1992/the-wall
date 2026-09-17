import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth";
import { prepareDeferredDestinationResume } from "@/lib/deferred-destination";
import { destinationForAccountRoute } from "@/lib/onboarding-contract";
import { Text } from "@/components/Text";
import { colors, markColors } from "@/theme";

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <Text variant="display" color={colors.ink}>the wall</Text>
      <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 16 }} />
    </View>
  );
}

export default function Index() {
  const { loading, session, accountRoute } = useAuth();
  const { fallback } = useLocalSearchParams<{ fallback?: string }>();

  // Resolved redirect target once the user is fully set up. `null` means the
  // consume effect hasn't run yet (we show a brief splash rather than routing).
  const [target, setTarget] = useState<string | null>(null);
  // Guards single-use consume against StrictMode's double-invoke of effects.
  const preparedFor = useRef<string | null>(null);

  useEffect(() => {
    // The server bootstrap is authoritative. In particular, a profile hidden by
    // deactivation/suspension must never be mistaken for a new account.
    if (loading || !session || accountRoute !== "ready") {
      setTarget(null);
      preparedFor.current = null;
      return;
    }
    const subject = session.user.id;
    if (preparedFor.current === subject) return;
    preparedFor.current = subject;
    void prepareDeferredDestinationResume(subject).then((result) => {
      if (preparedFor.current !== subject) return;
      if (result.status === "navigate" || result.status === "terminal_unavailable") {
        setTarget(result.href);
      } else if (result.status === "none" || result.status === "durable_disabled") {
        setTarget(fallback === "discover" ? "/(tabs)/discover" : "/(tabs)/home");
      }
      // `in_flight` means another invocation already owns the one navigation.
    }).catch(() => {
      if (preparedFor.current === subject) setTarget(fallback === "discover" ? "/(tabs)/discover" : "/(tabs)/home");
    });
  }, [loading, session, accountRoute, fallback]);

  if (loading) return <Splash />;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Splash />;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;

  // Fully set up, but the consume effect hasn't resolved a target yet.
  if (target === null) return <Splash />;
  return <Redirect href={target} />;
}
