import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { getPendingSharedWallInvite, respondToWallInvite } from "@/lib/walls";
import type { PendingSharedWallInvite } from "@/lib/shared-wall-contract";
import { colors, markColors, radius } from "@/theme";
import {
  acknowledgeDeferredArrival,
  claimDeferredAttemptReference,
  retryDeferredDestination,
  transferDeferredAttemptToUnavailable,
} from "@/lib/deferred-destination";
import type { DeferredAttemptToken, DeferredNavigationRef } from "@/lib/deferred-destination-contract";
import { resolveDeferredDestination } from "@/lib/deferred-destination-resolver";
import { destinationForAccountRoute } from "@/lib/onboarding-contract";
import { sharedInviteSubjectKey, sameSharedInviteSubject } from "@/lib/shared-invite-scope";

type ClaimedAttempt = { reference: string; subjectKey: string; token: DeferredAttemptToken | null };

export default function SharedWallInviteScreen() {
  const router = useRouter();
  const { id, __deferred_ref: rawReference } = useLocalSearchParams<{ id: string; __deferred_ref?: string }>();
  const wallId = String(id ?? "");
  const reference = typeof rawReference === "string" ? rawReference : null;
  const { loading: authLoading, session, accountRoute } = useAuth();
  const userId = session?.user.id;
  const subjectKey = sharedInviteSubjectKey(userId, wallId, reference, accountRoute === "ready");
  const [loadedSubjectKey, setLoadedSubjectKey] = useState<string | null>(null);
  const [deferredAttempt, setDeferredAttempt] = useState<ClaimedAttempt | null>(null);
  const [deferredReadyToken, setDeferredReadyToken] = useState<DeferredAttemptToken | null>(null);
  const claimedReference = useRef<string | null>(null);
  const [invite, setInvite] = useState<PendingSharedWallInvite>({ status: "unavailable" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const fence = useRef(new SessionFocusFence()).current;
  const mutationFence = useRef(new SessionFocusFence()).current;
  const currentSubjectKey = useRef(subjectKey);
  currentSubjectKey.current = subjectKey;
  const mutationInFlight = useRef(false);
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const activeAttempt = sameSharedInviteSubject(deferredAttempt?.subjectKey, subjectKey) ? deferredAttempt : null;

  useEffect(() => {
    if (!reference || !userId || !wallId || !subjectKey || accountRoute !== "ready" || claimedReference.current === subjectKey) return;
    claimedReference.current = subjectKey;
    setLoadedSubjectKey(null);
    setDeferredReadyToken(null);
    setLoading(true);
    setInvite({ status: "unavailable" });
    setError(null);
    setDeferredAttempt({
      reference,
      subjectKey,
      token: claimDeferredAttemptReference(
        reference as DeferredNavigationRef,
        { kind: "shared_invite", wallId },
        userId,
      ),
    });
  }, [accountRoute, reference, subjectKey, userId, wallId]);

  useEffect(() => {
    if (deferredReadyToken) void acknowledgeDeferredArrival(deferredReadyToken);
  }, [deferredReadyToken]);

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    const requestedSubjectKey = subjectKey;
    if (!token || !wallId || !requestedSubjectKey || (reference && !activeAttempt)) return;
    const capturedDeferredToken = reference ? activeAttempt?.token ?? null : null;
    setLoading(true); setError(null); setLoadedSubjectKey(null);
    setDeferredReadyToken(null);
    try {
      const invitePromise = getPendingSharedWallInvite(wallId);
      if (capturedDeferredToken) {
        const resolution = await resolveDeferredDestination(
          { kind: "shared_invite", wallId },
          token.userId,
          { invitation: async () => invitePromise },
        );
        if (!fence.isCurrent(token, currentUserId.current)
          || !sameSharedInviteSubject(requestedSubjectKey, currentSubjectKey.current)) return;
        setLoadedSubjectKey(requestedSubjectKey);
        if (resolution.status === "terminal_unavailable") {
          const unavailable = transferDeferredAttemptToUnavailable(capturedDeferredToken);
          if (unavailable) router.replace(unavailable.href as never);
          return;
        }
        if (resolution.status === "retryable_failure") {
          setError("We couldn't check this invitation. Check your connection and try again.");
          return;
        }
      }
      const next = await invitePromise;
      if (!fence.isCurrent(token, currentUserId.current)
        || !sameSharedInviteSubject(requestedSubjectKey, currentSubjectKey.current)) return;
      setLoadedSubjectKey(requestedSubjectKey);
      setInvite(next);
      if (next.status === "available" && capturedDeferredToken) setDeferredReadyToken(capturedDeferredToken);
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)
        && sameSharedInviteSubject(requestedSubjectKey, currentSubjectKey.current)) {
        setLoadedSubjectKey(requestedSubjectKey);
        setError(capturedDeferredToken
          ? "We couldn't check this invitation. Check your connection and try again."
          : cause?.message ?? "Couldn't check this invitation.");
      }
    } finally {
      if (fence.isCurrent(token, currentUserId.current)
        && sameSharedInviteSubject(requestedSubjectKey, currentSubjectKey.current)) setLoading(false);
    }
  }, [activeAttempt, fence, reference, router, subjectKey, userId, wallId]);

  useFocusEffect(useCallback(() => {
    fence.focus(userId ?? null);
    mutationFence.focus(userId ?? null);
    setLoadedSubjectKey(null); setInvite({ status: "unavailable" }); setDeclined(false); setBusy(null);
    if (userId && accountRoute === "ready" && wallId && (!reference || activeAttempt?.reference === reference)) void load(); else if (!reference && accountRoute === "ready") setLoading(false);
    return () => { fence.blur(); mutationFence.blur(); endExclusiveMutation(mutationInFlight); setBusy(null); };
  }, [accountRoute, activeAttempt?.subjectKey, fence, load, mutationFence, reference, userId, wallId]));

  async function respond(accept: boolean) {
    if (!userId || !subjectKey || !sameSharedInviteSubject(loadedSubjectKey, subjectKey)
      || !sameSharedInviteSubject(subjectKey, currentSubjectKey.current)
      || busy || invite.status !== "available" || !beginExclusiveMutation(mutationInFlight)) return;
    const token = mutationFence.begin(userId);
    if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusy(accept ? "accept" : "decline"); setError(null);
    try {
      const result = await respondToWallInvite(wallId, accept);
      if (!mutationFence.isCurrent(token, currentUserId.current)
        || !sameSharedInviteSubject(subjectKey, currentSubjectKey.current)) return;
      if (accept && result.status === "accepted") router.replace(`/shared/${wallId}`);
      else if (!accept && result.status === "declined") { setInvite({ status: "unavailable" }); setDeclined(true); }
      else { setInvite({ status: "unavailable" }); setError("That invitation is no longer available."); }
    } catch (cause: any) {
      if (mutationFence.isCurrent(token, currentUserId.current)
        && sameSharedInviteSubject(subjectKey, currentSubjectKey.current)) setError(cause?.message ?? "That invitation is no longer available.");
    } finally {
      // An old invitation/account cannot clear a new invitation response lock.
      if (mutationFence.isCurrent(token, currentUserId.current)
        && sameSharedInviteSubject(subjectKey, currentSubjectKey.current)) {
        endExclusiveMutation(mutationInFlight);
        setBusy(null);
      }
    }
  }

  async function retryLoad() {
    if (!subjectKey || !sameSharedInviteSubject(subjectKey, currentSubjectKey.current)) return;
    if (reference && !activeAttempt) return;
    const captured = reference ? activeAttempt?.token ?? null : null;
    if (captured && !await retryDeferredDestination(captured)) return;
    if (!sameSharedInviteSubject(subjectKey, currentSubjectKey.current)) return;
    await load();
  }

  if (authLoading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;
  if (reference && !activeAttempt) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (reference && activeAttempt && !activeAttempt.token) return <Redirect href="/(tabs)/home" />;
  if (loading || !sameSharedInviteSubject(loadedSubjectKey, subjectKey)) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (error) return <Screen><View style={{ marginTop: 24, gap: 12 }}><Text accessibilityRole="alert" variant="headline">We couldn&apos;t open this invitation.</Text><Text variant="body" color={colors.onSurfaceVariant}>{error}</Text><Button label="Retry" variant="yellow" onPress={() => void retryLoad()} /><Button label="My Wall" variant="ghost" onPress={() => router.replace("/(tabs)/home")} /></View></Screen>;
  return (
    <Screen>
      <Text variant="display" style={{ fontSize: 26, marginTop: 24 }}>Shared Wall invite</Text>
      <View style={{ marginTop: 18, padding: 18, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, backgroundColor: colors.card }}>
        {invite.status === "available" ? (
          <>
            <Text variant="headline">{invite.wallName}</Text>
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
              {invite.ownerDisplayName} invited you to this {invite.visibility} Shared Wall. Accept to join and see what your crew leaves there.
            </Text>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Button label="Accept invite" variant="yellow" loading={busy === "accept"} onPress={() => void respond(true)} />
              <Button label="Decline" variant="ghost" loading={busy === "decline"} onPress={() => void respond(false)} />
            </View>
          </>
        ) : (
          <>
            <Text variant="headline">{declined ? "Invitation declined" : "This invitation isn't available anymore."}</Text>
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>{declined ? "You won't be added to this Shared Wall." : "It may have been accepted, revoked, or the Shared Wall was removed."}</Text>
            <View style={{ gap: 10, marginTop: 18 }}><Button label="Back to Alerts" variant="primary" onPress={() => router.replace("/(tabs)/alerts")} /><Button label="My Wall" variant="ghost" onPress={() => router.replace("/(tabs)/home")} /></View>
          </>
        )}
      </View>
    </Screen>
  );
}
