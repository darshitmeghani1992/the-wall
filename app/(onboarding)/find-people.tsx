import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { inviteFriends } from "@/lib/share";
import { loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding";
import { AccountRouteFence } from "@/lib/onboarding-contract";
import { colors } from "@/theme";

/** Activation choice only; people search itself stays in the canonical Discover surface. */
export default function FindPeople() {
  const router = useRouter();
  const { session, profile, accountRoute } = useAuth();
  const userId = session?.user.id ?? null;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const lifecycleFence = useRef(new AccountRouteFence());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const currentFence = lifecycleFence.current;
    if (accountRoute && accountRoute !== "walkthrough") router.replace("/");
    return () => currentFence.invalidate(currentUserId.current);
  }, [accountRoute, router]);

  async function continueWith(destination: "discover" | null, share = false) {
    if (busy || !userId || accountRoute !== "walkthrough") return;
    const token = lifecycleFence.current.begin(userId);
    setBusy(true);
    try {
      if (share) await inviteFriends(profile?.handle);
      if (!lifecycleFence.current.isCurrent(token, currentUserId.current)) return;
      const draft = await loadOnboardingDraft(userId);
      await saveOnboardingDraft(userId, { ...draft, postWalkthroughDestination: destination });
      if (lifecycleFence.current.isCurrent(token, currentUserId.current)) router.replace("/walkthrough");
    } catch (cause: any) {
      if (lifecycleFence.current.isCurrent(token, currentUserId.current)) {
        Alert.alert("Couldn't continue", cause?.message ?? "Please try again.");
      }
    } finally {
      if (lifecycleFence.current.isCurrent(token, currentUserId.current)) setBusy(false);
    }
  }

  if (accountRoute && accountRoute !== "walkthrough") return <Redirect href="/" />;

  return (
    <Screen dockInset={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Text variant="label" color={colors.outline}>FIND YOUR PEOPLE</Text>
        <Text variant="display" style={{ fontSize: 32 }}>A Wall gets better together.</Text>
        <Text variant="body" color={colors.onSurfaceVariant}>
          Search The-Wall after the quick tour, or invite someone now. We won't ask for your contacts.
        </Text>
      </View>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Button label="Search The-Wall" variant="yellow" loading={busy} onPress={() => void continueWith("discover")} />
        <Button label="Share an invitation" variant="primary" disabled={busy} onPress={() => void continueWith(null, true)} />
        <Button label="Skip for now" variant="ghost" disabled={busy} onPress={() => void continueWith(null)} />
      </View>
    </Screen>
  );
}
