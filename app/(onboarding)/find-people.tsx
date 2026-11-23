import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { inviteFriends } from "@/lib/share";
import { loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding";
import { AccountRouteFence, onboardingScreenScopeKey, type AccountRoute } from "@/lib/onboarding-contract";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { colors } from "@/theme";

/** Activation choice only; people search itself stays in the canonical Discover surface. */
export default function FindPeople() {
  const { session, profile, accountRoute } = useAuth();
  const actorId = session?.user.id ?? null;
  const liveActorId = useRef<string | null>(actorId);
  // An old sharing callback may survive unmount; use current render identity.
  liveActorId.current = actorId;
  const actorHandle = actorId && profile?.id === actorId ? profile.handle : null;
  return (
    <FindPeopleEditor
      key={onboardingScreenScopeKey(actorId, accountRoute)}
      userId={actorId}
      actorHandle={actorHandle}
      accountRoute={accountRoute}
      liveActorId={liveActorId}
    />
  );
}

function FindPeopleEditor({
  userId,
  actorHandle,
  accountRoute,
  liveActorId,
}: {
  userId: string | null;
  actorHandle: string | null;
  accountRoute: AccountRoute | null;
  liveActorId: { current: string | null };
}) {
  const router = useRouter();
  const lifecycleFence = useRef(new AccountRouteFence());
  const continuationInFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const currentFence = lifecycleFence.current;
    if (accountRoute && accountRoute !== "walkthrough") router.replace("/");
    return () => currentFence.invalidate(liveActorId.current);
  }, [accountRoute, liveActorId, router]);

  async function continueWith(destination: "discover" | null, share = false) {
    if (!userId || userId !== liveActorId.current || accountRoute !== "walkthrough") return;
    if (!beginExclusiveMutation(continuationInFlight)) return;
    const token = lifecycleFence.current.begin(userId);
    setBusy(true);
    try {
      if (share) await inviteFriends(actorHandle);
      if (!lifecycleFence.current.isCurrent(token, liveActorId.current)) return;
      const draft = await loadOnboardingDraft(userId);
      // Draft read is asynchronous. Do not write A's draft after B signs in.
      if (!lifecycleFence.current.isCurrent(token, liveActorId.current)) return;
      await saveOnboardingDraft(userId, { ...draft, postWalkthroughDestination: destination });
      if (lifecycleFence.current.isCurrent(token, liveActorId.current)) router.replace("/walkthrough");
    } catch (cause: any) {
      if (lifecycleFence.current.isCurrent(token, liveActorId.current)) {
        Alert.alert("Couldn't continue", cause?.message ?? "Please try again.");
      }
    } finally {
      if (lifecycleFence.current.isCurrent(token, liveActorId.current)) {
        endExclusiveMutation(continuationInFlight);
        setBusy(false);
      }
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
