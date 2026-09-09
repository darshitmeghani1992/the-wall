import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { consumePendingLink } from "@/lib/pendingLink";
import { destinationForAccountRoute } from "@/lib/onboarding-contract";
import { Text } from "@/components/Text";
import { colors, markColors } from "@/theme";

/**
 * App entry / auth gate. Branches on auth + profile state:
 *   - loading            → splash spinner
 *   - signed out         → onboarding welcome
 *   - signed in, no row  → profile setup
 *   - fully set up        → a pending deep-link target (if any), else Home
 *
 * A deep link opened while signed out stashes its target (pendingLink); once the
 * user is fully set up we consume it — from an effect, exactly once — so the
 * intended Wall isn't lost across sign-in / onboarding. Consuming clears the
 * module-level pending href, so it must NOT run during render (that would be a
 * render side effect and StrictMode's double-render could drop the target).
 */
function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <Text variant="display" color={colors.ink}>
        the wall
      </Text>
      <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 16 }} />
    </View>
  );
}

export default function Index() {
  const { loading, session, accountRoute } = useAuth();

  // Resolved redirect target once the user is fully set up. `null` means the
  // consume effect hasn't run yet (we show a brief splash rather than routing).
  const [target, setTarget] = useState<string | null>(null);
  // Guards single-use consume against StrictMode's double-invoke of effects.
  const consumedFor = useRef<string | null>(null);

  useEffect(() => {
    // The server bootstrap is authoritative. In particular, a profile hidden by
    // deactivation/suspension must never be mistaken for a new account.
    if (loading || !session || accountRoute !== "ready") {
      setTarget(null);
      consumedFor.current = null;
      return;
    }
    if (consumedFor.current === session.user.id) return;
    consumedFor.current = session.user.id;
    setTarget(consumePendingLink() ?? "/(tabs)/home");
  }, [loading, session, accountRoute]);

  if (loading) return <Splash />;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Splash />;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;

  // Fully set up, but the consume effect hasn't resolved a target yet.
  if (target === null) return <Splash />;
  return <Redirect href={target} />;
}
