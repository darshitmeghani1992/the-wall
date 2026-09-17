import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Masonry } from "@/components/Masonry";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { MarkDetailModal } from "@/components/marks/MarkDetailModal";
import { useAuth } from "@/lib/auth";
import { getWall, getWallCapabilities, joinSharedWall, leaveSharedWall, type WallCapabilities } from "@/lib/walls";
import { getWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { getProfile } from "@/lib/profiles";
import { SessionFocusFence } from "@/lib/session-generation";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { shareSharedWall } from "@/lib/share";
import type { Profile, Wall } from "@/lib/types";
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

type ClaimedAttempt = { reference: string; token: DeferredAttemptToken | null };

export default function SharedWallScreen() {
  const router = useRouter();
  const { id, justCreated, focusMark, __deferred_ref: rawReference } = useLocalSearchParams<{ id: string; justCreated?: string; focusMark?: string; __deferred_ref?: string }>();
  const wallId = String(id ?? "");
  const justCreatedId = justCreated ? String(justCreated) : null;
  const focusMarkId = focusMark ? String(focusMark) : null;
  const reference = typeof rawReference === "string" ? rawReference : null;
  const { loading: authLoading, session, accountRoute } = useAuth();
  const userId = session?.user.id;
  const [deferredAttempt, setDeferredAttempt] = useState<ClaimedAttempt | null>(null);
  const [deferredReadyToken, setDeferredReadyToken] = useState<DeferredAttemptToken | null>(null);
  const claimedReference = useRef<string | null>(null);
  const [wall, setWall] = useState<Wall | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [capabilities, setCapabilities] = useState<WallCapabilities | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"join" | "leave" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMark, setSelectedMark] = useState<MarkWithAuthor | null>(null);
  const [focusedMarkUnavailable, setFocusedMarkUnavailable] = useState(false);
  const dropIds = useRef<Set<string>>(new Set(justCreatedId ? [justCreatedId] : []));
  const fence = useRef(new SessionFocusFence()).current;
  const mutationInFlight = useRef(false);
  const currentUserId = useRef<string | null>(userId ?? null);
  const currentWallId = useRef(wallId);
  currentUserId.current = userId ?? null;
  currentWallId.current = wallId;

  useEffect(() => {
    if (!reference || !userId || !wallId || accountRoute !== "ready" || claimedReference.current === reference) return;
    claimedReference.current = reference;
    setDeferredReadyToken(null);
    setLoading(true);
    setWall(null);
    setOwner(null);
    setCapabilities(null);
    setMarks([]);
    setSelectedMark(null);
    setDeferredAttempt({
      reference,
      token: claimDeferredAttemptReference(
        reference as DeferredNavigationRef,
        { kind: "shared", wallId, focusMarkId },
        userId,
      ),
    });
  }, [accountRoute, focusMarkId, reference, userId, wallId]);

  useEffect(() => {
    if (deferredReadyToken) void acknowledgeDeferredArrival(deferredReadyToken);
  }, [deferredReadyToken]);

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    const requestedWallId = wallId;
    if (!token || !requestedWallId) return;
    const capturedDeferredToken = reference ? deferredAttempt?.token ?? null : null;
    setLoading(true);
    setDeferredReadyToken(null);
    setError(null);
    setFocusedMarkUnavailable(false);
    try {
      const wallPromise = getWall(requestedWallId);
      const capabilitiesPromise = getWallCapabilities(requestedWallId);
      let marksPromise: Promise<MarkWithAuthor[]> | null = null;
      if (capturedDeferredToken) {
        const destination = focusMarkId
          ? { kind: "mark" as const, markId: focusMarkId, container: { kind: "shared" as const, wallId: requestedWallId } }
          : { kind: "shared_wall" as const, wallId: requestedWallId };
        const resolution = await resolveDeferredDestination(destination, token.userId, {
          sharedWall: async () => {
            const [wall, wallCapabilities] = await Promise.all([wallPromise, capabilitiesPromise]);
            return wall?.type === "shared" && wallCapabilities?.wallType === "shared" ? wall : null;
          },
          wallMarks: async (resolvedWallId) => {
            marksPromise ??= getWallMarks(resolvedWallId);
            return marksPromise;
          },
        });
        if (!fence.isCurrent(token, currentUserId.current) || currentWallId.current !== requestedWallId) return;
        if (resolution.status === "terminal_unavailable") {
          const unavailable = transferDeferredAttemptToUnavailable(capturedDeferredToken);
          if (unavailable) router.replace(unavailable.href as never);
          return;
        }
        if (resolution.status === "retryable_failure") {
          setError("We couldn't open this Shared Wall. Check your connection and try again.");
          return;
        }
      }
      const [nextWall, nextCapabilities] = await Promise.all([wallPromise, capabilitiesPromise]);
      if (!fence.isCurrent(token, currentUserId.current) || currentWallId.current !== requestedWallId) return;
      if (!nextWall || nextWall.type !== "shared" || !nextCapabilities || nextCapabilities.wallType !== "shared") {
        setWall(null);
        setError("This Shared Wall isn't available.");
        return;
      }
      const [ownerProfile, nextMarks] = await Promise.all([getProfile(nextWall.owner_id), marksPromise ?? getWallMarks(nextWall.id)]);
      if (!fence.isCurrent(token, currentUserId.current) || currentWallId.current !== requestedWallId) return;
      setWall(nextWall);
      setCapabilities(nextCapabilities);
      setOwner(ownerProfile);
      setMarks(nextMarks);
      if (focusMarkId) {
        const focused = nextMarks.find((mark) => mark.id === focusMarkId) ?? null;
        setSelectedMark(focused);
        setFocusedMarkUnavailable(!focused);
      }
      if (capturedDeferredToken) setDeferredReadyToken(capturedDeferredToken);
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(capturedDeferredToken
          ? "We couldn't open this Shared Wall. Check your connection and try again."
          : cause?.message ?? "Couldn't open this Shared Wall.");
      }
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [deferredAttempt, fence, focusMarkId, reference, router, userId, wallId]);

  useFocusEffect(useCallback(() => {
    fence.focus(userId ?? null);
    setWall(null); setOwner(null); setCapabilities(null); setMarks([]); setSelectedMark(null); setBusy(null);
    if (userId && accountRoute === "ready" && wallId && (!reference || deferredAttempt?.reference === reference)) void load(); else if (!reference && accountRoute === "ready") setLoading(false);
    return () => { fence.blur(); endExclusiveMutation(mutationInFlight); setBusy(null); };
  }, [accountRoute, deferredAttempt?.reference, fence, load, reference, userId, wallId]));

  useStaggeredArrivals(wall?.id, (mark) => {
    dropIds.current.add(mark.id);
    setMarks((current) => current.some((item) => item.id === mark.id) ? current : [mark, ...current]);
  });
  const { summaries, toggle } = useWallReactions(marks, userId);

  async function join() {
    if (!userId || busy || capabilities?.wallType !== "shared" || !capabilities.canJoin || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId);
    if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusy("join"); setError(null);
    try {
      const result = await joinSharedWall(wallId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (result.status !== "joined" && result.status !== "already_member") {
        setError("Joining isn't available. The owner can invite you.");
        return;
      }
      setBusy(null);
      void load();
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Couldn't join this Shared Wall.");
    } finally {
      endExclusiveMutation(mutationInFlight);
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  function confirmLeave() {
    Alert.alert("Leave this Shared Wall?", "You can join again later only if Open Join is available or the owner invites you.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => void leave() },
    ]);
  }

  async function leave() {
    if (!userId || busy || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId);
    if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusy("leave");
    try {
      const result = await leaveSharedWall(wallId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (result.status === "left") router.replace("/(tabs)/home");
      else setError("This membership has already changed.");
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Couldn't leave this Shared Wall.");
    } finally {
      endExclusiveMutation(mutationInFlight);
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  async function share() {
    try {
      await shareSharedWall(wallId, wall?.name ?? "Shared Wall");
    } catch {
      setError("Couldn't open sharing. Please try again.");
    }
  }

  async function retryLoad() {
    const captured = deferredAttempt?.token ?? null;
    if (captured && !await retryDeferredDestination(captured)) return;
    await load();
  }

  if (authLoading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;
  if (reference && deferredAttempt?.reference !== reference) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (reference && deferredAttempt?.reference === reference && !deferredAttempt.token) return <Redirect href="/(tabs)/home" />;
  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (error && !wall) return <Unavailable message={error} onBack={() => router.back()} onRetry={() => void retryLoad()} />;
  if (!wall || capabilities?.wallType !== "shared") return <Unavailable message="This Shared Wall isn't available." onBack={() => router.back()} onRetry={() => void retryLoad()} />;

  const joinState = capabilities.joinState;
  const isOwner = joinState === "owner";
  const isMember = joinState === "member";
  const canLeaveMark = capabilities.canContribute;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <View style={{ backgroundColor: colors.ink, padding: 10, borderRadius: radius.card, marginTop: 8, marginBottom: 16 }}>
        <Text variant="label" color={markColors.brandYellow} style={{ textAlign: "center" }}>SHARED WALL · {wall.visibility === "public" ? "PUBLIC" : "PRIVATE"}</Text>
      </View>
      <Text variant="display" style={{ fontSize: 26 }}>{wall.name}</Text>
      <Text variant="body" color={colors.outline} style={{ marginTop: 4 }}>
        {owner ? `Started by ${owner.display_name}` : "Shared Wall"} · {marks.length} marks · {isOwner ? "owner" : isMember ? "member" : "viewer"}
      </Text>

      {error ? <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: 12 }}>{error}</Text> : null}
      {focusedMarkUnavailable ? <Text accessibilityRole="alert" variant="body" color={colors.outline} style={{ marginTop: 12 }}>This Mark isn&apos;t available anymore.</Text> : null}

      <View style={{ gap: 10, marginTop: 16, marginBottom: 16 }}>
        {canLeaveMark ? <Button label={`Leave a Mark on ${wall.name}`} variant="yellow" onPress={() => router.push(`/create?sharedWallId=${wall.id}&wallName=${encodeURIComponent(wall.name)}`)} /> : null}
        {capabilities.canJoin ? <Button label="Join Shared Wall" variant="yellow" loading={busy === "join"} onPress={() => void join()} /> : null}
        {joinState === "invited" ? <Button label="Review invitation" variant="yellow" onPress={() => router.push(`/shared/invite/${wall.id}`)} /> : null}
        {(isOwner || isMember) ? <Button label="Members" variant="primary" onPress={() => router.push(`/shared/${wall.id}/members`)} /> : null}
        {isOwner ? <Button label="Wall settings" variant="primary" onPress={() => router.push(`/shared/${wall.id}/settings`)} /> : null}
        <Button label="Share view-only link ↗" variant="ghost" onPress={() => void share()} />
        {!isOwner ? <Button label="Report Shared Wall" variant="ghost" onPress={() => router.push(`/report-wall/${wall.id}`)} /> : null}
        {isMember ? <Button label="Leave Shared Wall" variant="ghost" loading={busy === "leave"} onPress={confirmLeave} /> : null}
      </View>

      {joinState === "owner_approval_required" ? <StateNotice text="You can view this Wall, but only the owner can add you back." /> : null}
      {joinState === "invite_required" ? <StateNotice text={wall.visibility === "public" ? "You can view this Wall. Joining requires an invitation from the owner." : "Only accepted members can open this Wall."} /> : null}
      {joinState === "invited" ? <StateNotice text="You have an invitation waiting. Accept it before leaving Marks." /> : null}

      {marks.length ? (
        <Masonry data={marks} keyFor={(mark) => mark.id} estimate={estimateMarkHeight} renderItem={(mark, index) => (
          <MarkView mark={mark} enter={dropIds.current.has(mark.id) ? "drop" : "settle"} enterIndex={index} highlight={mark.id === justCreatedId} reactions={summaries[mark.id]} onToggleReaction={(emoji) => toggle(mark.id, emoji)} onOpenDetail={() => setSelectedMark(mark)} />
        )} />
      ) : (
        <View style={{ paddingVertical: 36, alignItems: "center" }}><Text variant="headline">No Marks yet</Text><Text variant="body" color={colors.outline} style={{ marginTop: 6, textAlign: "center" }}>{canLeaveMark ? `Be the first to leave a Mark on ${wall.name}.` : "This Shared Wall is waiting for its first Mark."}</Text></View>
      )}
      <MarkDetailModal mark={selectedMark} viewerId={userId} wallOwnerId={wall.owner_id} reactions={selectedMark ? summaries[selectedMark.id] : undefined} onToggleReaction={selectedMark ? (emoji) => toggle(selectedMark.id, emoji) : undefined} onClose={() => setSelectedMark(null)} onMarkUpdated={(markId, text) => { setMarks((current) => current.map((item) => item.id === markId ? { ...item, text } : item)); setSelectedMark((current) => current?.id === markId ? { ...current, text } : current); }} onMarkRemoved={(markId) => setMarks((current) => current.filter((item) => item.id !== markId))} />
    </Screen>
  );
}

function StateNotice({ text }: { text: string }) {
  return <View style={{ borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.card, padding: 14, marginBottom: 18 }}><Text variant="body" color={colors.onSurfaceVariant}>{text}</Text></View>;
}

function Unavailable({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  return <Screen><Text variant="display" style={{ fontSize: 26, marginTop: 24 }}>Shared Wall</Text><Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: 14 }}>{message}</Text><View style={{ gap: 10, marginTop: 20 }}><Button label="Try again" variant="yellow" onPress={onRetry} /><Button label="Go back" variant="ghost" onPress={onBack} /></View></Screen>;
}
