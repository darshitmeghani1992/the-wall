import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MarkCard } from "@/components/MarkCard";
import { useAuth } from "@/lib/auth";
import { completeWalkthrough } from "@/lib/account";
import { clearOnboardingDraft, loadOnboardingDraft } from "@/lib/onboarding";
import { destinationAfterWalkthrough, AccountRouteFence, walkthroughRequiresPersistence } from "@/lib/onboarding-contract";
import { colors, markColors } from "@/theme";

const MOMENTS = [
  { title: "This is your Wall.", detail: "It is your personal place for memories from your people." },
  { title: "Your people leave Marks here.", detail: "Notes, photos, voice and video become part of your Wall." },
  { title: "Invite or find your people.", detail: "Share your Wall, or use Discover whenever you want." },
  { title: "Visit their Wall.", detail: "That's where you leave a Mark for someone else." },
] as const;

/** Once-only first-use teaching. `replay=1` is presentation-only and never writes progress. */
export default function Walkthrough() {
  const { session, accountRoute } = useAuth();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const actorId = session?.user.id ?? null;
  const liveActorId = useRef<string | null>(actorId);
  liveActorId.current = actorId;
  // The tour's index, mutation lease and replay mode belong to one account.
  // Keep this editor mounted when finishing onboarding advances the server route
  // to "ready"; its in-flight callback must still resolve the deferred destination.
  const scopeKey = `${actorId ?? "signed-out"}:${replay === "1" ? "replay" : "first-use"}`;
  return <WalkthroughEditor key={scopeKey} liveActorId={liveActorId} />;
}

function WalkthroughEditor({ liveActorId }: { liveActorId: { current: string | null } }) {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === "1";
  const reducedMotion = useReducedMotion();
  const { session, accountRoute, refreshAccountRoute } = useAuth();
  const userId = session?.user.id ?? null;
  const lifecycleFence = useRef(new AccountRouteFence());
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const moment = MOMENTS[index];

  useEffect(() => {
    const currentFence = lifecycleFence.current;
    const allowed = isReplay
      ? accountRoute === "ready"
      : accountRoute === "walkthrough" || inFlight.current;
    if (accountRoute && !allowed) router.replace("/");
    return () => currentFence.invalidate(liveActorId.current);
  }, [accountRoute, isReplay, liveActorId, router]);

  async function leave() {
    if (inFlight.current || userId !== liveActorId.current) return;
    if (!walkthroughRequiresPersistence(isReplay)) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/home");
      return;
    }
    if (!userId) {
      router.replace("/");
      return;
    }
    const token = lifecycleFence.current.begin(userId);
    inFlight.current = true;
    setBusy(true);
    try {
      await completeWalkthrough(userId);
      if (!lifecycleFence.current.isCurrent(token, liveActorId.current)) return;
      const draft = await loadOnboardingDraft(userId);
      // A different actor can sign in during the local draft read.
      if (!lifecycleFence.current.isCurrent(token, liveActorId.current)) return;
      try { await clearOnboardingDraft(userId); } catch { /* Completion is already durable server-side. */ }
      // Never refresh the new actor's route from a completed old-actor tour.
      if (!lifecycleFence.current.isCurrent(token, liveActorId.current)) return;
      await refreshAccountRoute();
      if (liveActorId.current === userId) {
        const target = destinationAfterWalkthrough(draft.postWalkthroughDestination);
        router.replace(target as never);
      }
    } catch (cause: any) {
      if (liveActorId.current === userId) {
        Alert.alert("Couldn't finish the tour", cause?.message ?? "Please try again.");
      }
    } finally {
      if (liveActorId.current === userId) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  const routeAllowed = isReplay
    ? accountRoute === "ready"
    : accountRoute === "walkthrough" || inFlight.current;
  if (accountRoute && !routeAllowed) return <Redirect href="/" />;

  return (
    <Screen scroll={false} dockInset={false}>
      <View style={{ paddingTop: 24, flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="label" color={colors.outline}>{isReplay ? "HELP TOUR" : `QUICK TOUR · ${index + 1}/4`}</Text>
        <Text variant="label" color={colors.outline}>{reducedMotion ? "REDUCED MOTION" : ""}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: "center", gap: 22 }}>
        <MarkCard id={`walkthrough-${index}`} background={index % 2 ? markColors.skyBlue : markColors.stickyYellow} fastener="pin" enter={reducedMotion ? "none" : "settle"}>
          <Text variant="label" color={colors.outline}>INSTRUCTIONAL EXAMPLE</Text>
          <Text variant="mark" style={{ fontSize: 20, marginTop: 10 }}>{moment.title}</Text>
        </MarkCard>
        <View style={{ gap: 8 }}>
          <Text variant="display" style={{ fontSize: 30 }}>{moment.title}</Text>
          <Text variant="body" color={colors.onSurfaceVariant}>{moment.detail}</Text>
        </View>
      </View>
      <View style={{ gap: 10, paddingBottom: 12 }}>
        {index < MOMENTS.length - 1 ? (
          <Button label="Next" variant="yellow" onPress={() => setIndex((current) => current + 1)} />
        ) : (
          <Button label={isReplay ? "Close tour" : "Go to The-Wall"} variant="yellow" loading={busy} onPress={() => void leave()} />
        )}
        {index < MOMENTS.length - 1 ? (
          <Button label={isReplay ? "Close tour" : "Skip tour"} variant="ghost" disabled={busy} onPress={() => void leave()} />
        ) : null}
      </View>
    </Screen>
  );
}
