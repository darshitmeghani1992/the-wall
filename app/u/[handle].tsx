import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { getProfileByHandle } from "@/lib/profiles";
import { setPendingLink } from "@/lib/pendingLink";
import { colors, markColors } from "@/theme";

/**
 * Handle deep link — `thewall://u/<handle>` opens that person's Wall.
 *
 * Resolves a @handle to a profile, then routes to their Wall (or to /wall if the
 * handle is the signed-in user's own). If the app is opened cold and signed out,
 * the intended target is stashed (pendingLink) and the auth gate returns here
 * after sign-in / onboarding — so the link isn't lost across auth.
 *
 * This is the SAFE, in-app portion of deep linking. Universal / https App Links
 * (opening thewall.app/@handle straight into the app) need native config
 * (associatedDomains + intentFilters + domain verification) — a reported infra
 * dependency, not implemented here.
 */
function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={markColors.brandYellow} />
    </View>
  );
}

export default function HandleLink() {
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const clean = String(handle ?? "").replace(/^@/, "");
  const { loading, session, needsProfile } = useAuth();
  const [notFound, setNotFound] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (loading) return;
      // Not ready to resolve yet — stash the target and let the gate come back here.
      if (!session || needsProfile) {
        setPendingLink(`/u/${clean}`);
        return;
      }
      const profile = await getProfileByHandle(clean);
      if (!active) return;
      if (!profile) {
        setNotFound(true);
        return;
      }
      setTarget(profile.id === session.user.id ? "/wall" : `/person/${profile.id}`);
    })().catch(() => {
      if (active) setNotFound(true);
    });
    return () => {
      active = false;
    };
  }, [loading, session, needsProfile, clean]);

  if (loading) return <Spinner />;
  // Signed out / mid-onboarding: send through the gate; pending target is stashed.
  if (!session) return <Redirect href="/welcome" />;
  if (needsProfile) return <Redirect href="/profile-setup" />;
  if (target) return <Redirect href={target} />;

  if (notFound) {
    return (
      <Screen dockInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text variant="headline">No wall for @{clean}</Text>
          <Text variant="body" color={colors.outline} style={{ textAlign: "center" }}>
            That handle doesn't exist, or the link is out of date.
          </Text>
          <Button label="Back to my Wall" variant="primary" onPress={() => router.replace("/home")} />
        </View>
      </Screen>
    );
  }

  return <Spinner />;
}
