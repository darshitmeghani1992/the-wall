import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Masonry } from "@/components/Masonry";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { MarkDetailModal } from "@/components/marks/MarkDetailModal";
import { WallStatus } from "@/components/WallStatus";
import { SocialLinks } from "@/components/SocialLinks";
import { useAuth } from "@/lib/auth";
import { blockUser, isUserBlockedByMe, unblockUser } from "@/lib/blocks";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getRelationship,
  sendFriendRequest,
  unfriend,
  type RelationshipState,
} from "@/lib/friendships";
import { getFollowCounts, isFollowing, followUser, unfollowUser } from "@/lib/follows";
import { getWallMark, listWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { mergeWallMarks, type MarkCursor } from "@/lib/mark-history-cursor";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { sharePersonWall } from "@/lib/share";
import { getProfile } from "@/lib/profiles";
import type { Profile, Wall } from "@/lib/types";
import {
  TargetRouteFence,
  classifyOtherWallAvailability,
  contributionUnavailableCopy,
  friendActionsFor,
  type FriendActionKind,
} from "@/lib/relationship-ui";
import { SessionFocusFence } from "@/lib/session-generation";
import { settleOptional } from "@/lib/optional-result";
import {
  getPublicSharedWallCount,
  getReadablePersonalWall,
  getWallCapabilities,
  type WallCapabilities,
} from "@/lib/walls";
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

export default function PersonWall() {
  const router = useRouter();
  const { id, justCreated, focusMark, __deferred_ref: rawReference } = useLocalSearchParams<{
    id: string;
    justCreated?: string;
    focusMark?: string;
    __deferred_ref?: string;
  }>();
  const justCreatedId = justCreated ? String(justCreated) : null;
  const focusMarkId = focusMark ? String(focusMark) : null;
  const reference = typeof rawReference === "string" ? rawReference : null;
  const { loading: authLoading, session, accountRoute } = useAuth();
  const [deferredAttempt, setDeferredAttempt] = useState<ClaimedAttempt | null>(null);
  const [deferredReadyToken, setDeferredReadyToken] = useState<DeferredAttemptToken | null>(null);
  const claimedReference = useRef<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wall, setWall] = useState<Wall | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<MarkCursor | null>(null);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [focusedMark, setFocusedMark] = useState<MarkWithAuthor | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const pageGeneration = useRef(0);
  const [relationship, setRelationship] = useState<RelationshipState>("none");
  const [capabilities, setCapabilities] = useState<WallCapabilities | null>(null);
  const [following, setFollowing] = useState(false);
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [counts, setCounts] = useState<{ followers: number; following: number; publicWalls: number } | null>(null);
  const [socialDetailsUnavailable, setSocialDetailsUnavailable] = useState(false);
  const [followStateAvailable, setFollowStateAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMark, setSelectedMark] = useState<MarkWithAuthor | null>(null);
  const [focusedMarkUnavailable, setFocusedMarkUnavailable] = useState(false);
  const currentUserId = useRef<string | null>(session?.user.id ?? null);
  const currentPersonId = useRef<string | null>(typeof id === "string" ? id : null);
  const loadFence = useRef(new SessionFocusFence());
  const actionFence = useRef(new SessionFocusFence());
  const targetRouteFence = useRef(new TargetRouteFence());
  const actionInFlight = useRef(false);
  const dropIds = useRef<Set<string>>(new Set(justCreatedId ? [justCreatedId] : []));
  currentUserId.current = session?.user.id ?? null;
  currentPersonId.current = typeof id === "string" ? id : null;

  useEffect(() => {
    const subject = session?.user.id;
    const personId = typeof id === "string" ? id : null;
    if (!reference || !subject || !personId || accountRoute !== "ready" || claimedReference.current === reference) return;
    claimedReference.current = reference;
    setDeferredReadyToken(null);
    setLoading(true);
    setProfile(null);
    setWall(null);
    setMarks([]);
    setSelectedMark(null);
    setDeferredAttempt({
      reference,
      token: claimDeferredAttemptReference(
        reference as DeferredNavigationRef,
        { kind: "personal", ownerId: personId, focusMarkId },
        subject,
      ),
    });
  }, [accountRoute, focusMarkId, id, reference, session?.user.id]);

  useEffect(() => {
    if (deferredReadyToken) void acknowledgeDeferredArrival(deferredReadyToken);
  }, [deferredReadyToken]);

  const load = useCallback(async () => {
    const generation = ++pageGeneration.current;
    const viewerId = session?.user.id ?? null;
    const personId = typeof id === "string" ? id : null;
    const token = loadFence.current.begin(viewerId);
    if (!token || !personId) return;
    const capturedDeferredToken = reference ? deferredAttempt?.token ?? null : null;
    if (viewerId === personId) {
      router.replace("/(tabs)/home");
      return;
    }
    setLoading(true);
    setDeferredReadyToken(null);
    setError(null);
    setFocusedMarkUnavailable(false);
    setSocialDetailsUnavailable(false);
    setFollowStateAvailable(true);
    setSelectedMark(null);
    setWall(null);
    setMarks([]);
    setNextCursor(null); setOlderBusy(false); setOlderError(false); setFocusedMark(null);
    setLoadedIdentity(null);
    setCapabilities(null);
    try {
      const blocked = await isUserBlockedByMe(personId);
      if (!loadFence.current.isCurrent(token, currentUserId.current)) return;
      setBlockedByMe(blocked);
      if (blocked) {
        setProfile(null);
        setRelationship("none");
        setFollowing(false);
        setCounts(null);
        if (capturedDeferredToken) {
          const unavailable = transferDeferredAttemptToUnavailable(capturedDeferredToken);
          if (unavailable) router.replace(unavailable.href as never);
        }
        return;
      }
      const personPromise = getProfile(personId);
      const personalWallPromise = getReadablePersonalWall(personId);
      let capabilitiesPromise: Promise<WallCapabilities | null> | null = null;
      let markPromise: Promise<MarkWithAuthor | null> | null = null;
      if (capturedDeferredToken) {
        const destination = focusMarkId
          ? { kind: "mark" as const, markId: focusMarkId, container: { kind: "personal" as const, ownerId: personId } }
          : { kind: "personal_user" as const, userId: personId };
        const resolution = await resolveDeferredDestination(destination, token.userId, {
          personalWall: async () => {
            const [person, personalWall] = await Promise.all([personPromise, personalWallPromise]);
            if (!person || !personalWall) return null;
            capabilitiesPromise ??= getWallCapabilities(personalWall.id);
            const wallCapabilities = await capabilitiesPromise;
            return wallCapabilities ? personalWall : null;
          },
          wallMark: async (wallId, markId) => {
            markPromise ??= getWallMark(wallId, markId);
            return markPromise;
          },
        });
        if (!loadFence.current.isCurrent(token, currentUserId.current)) return;
        if (resolution.status === "terminal_unavailable") {
          const unavailable = transferDeferredAttemptToUnavailable(capturedDeferredToken);
          if (unavailable) router.replace(unavailable.href as never);
          return;
        }
        if (resolution.status === "retryable_failure") {
          setError("This Wall isn't available right now. Try again.");
          return;
        }
      }
      const [person, personalWall, state, followCounts, publicWalls] = await Promise.all([
        personPromise,
        personalWallPromise,
        getRelationship(token.userId, personId),
        settleOptional(getFollowCounts(personId)),
        settleOptional(getPublicSharedWallCount(personId)),
      ]);
      if (!loadFence.current.isCurrent(token, currentUserId.current)) return;
      if (!person || !personalWall) {
        return;
      }
      setProfile(person);
      setWall(personalWall);
      setRelationship(state);
      if (followCounts.available && publicWalls.available) {
        setCounts({ ...followCounts.value, publicWalls: publicWalls.value });
        setSocialDetailsUnavailable(false);
      } else {
        setCounts(null);
        setSocialDetailsUnavailable(true);
      }
      setFollowing(false);
      setFollowStateAvailable(personalWall.visibility !== "public");
      if (personalWall) {
        capabilitiesPromise ??= getWallCapabilities(personalWall.id);
        const wallCapabilities = await capabilitiesPromise;
        if (!loadFence.current.isCurrent(token, currentUserId.current)) return;
        setCapabilities(wallCapabilities);
        if (!wallCapabilities) {
          return;
        }
        const [page, exactMark, followState] = await Promise.all([
          listWallMarks(personalWall.id),
          focusMarkId ? (markPromise ?? getWallMark(personalWall.id, focusMarkId)) : Promise.resolve(null),
          settleOptional(personalWall.visibility === "public" ? isFollowing(token.userId, personId) : Promise.resolve(false)),
        ]);
        if (!loadFence.current.isCurrent(token, currentUserId.current) || generation !== pageGeneration.current) return;
        setMarks(page.items);
        setLoadedIdentity(`${viewerId}:${personId}:${focusMarkId ?? ""}`);
        setNextCursor(page.nextCursor);
        setFollowing(followState.available ? followState.value : false);
        setFollowStateAvailable(followState.available);
        if (focusMarkId) {
          setFocusedMark(exactMark);
          setSelectedMark(exactMark?.secret ? null : exactMark);
          setFocusedMarkUnavailable(!exactMark);
        }
        if (capturedDeferredToken) setDeferredReadyToken(capturedDeferredToken);
      }
    } catch {
      if (loadFence.current.isCurrent(token, currentUserId.current)) {
        setError("This Wall isn't available right now. Try again.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [deferredAttempt, focusMarkId, id, reference, router, session?.user.id]);

  useFocusEffect(useCallback(() => {
    const viewerId = session?.user.id ?? null;
    const personId = typeof id === "string" ? id : null;
    loadFence.current.focus(viewerId);
    actionFence.current.focus(viewerId);
    targetRouteFence.current.focus(personId);
    setFollowBusy(false);
    setRelationshipBusy(false);
    setSafetyBusy(false);
    actionInFlight.current = false;
    if (viewerId && accountRoute === "ready" && (!reference || deferredAttempt?.reference === reference)) void load();
    else {
      setProfile(null);
      setWall(null);
      setMarks([]);
      setCapabilities(null);
      setCounts(null);
      setBlockedByMe(false);
      setLoading(false);
    }
    return () => {
      pageGeneration.current++;
      loadFence.current.blur();
      actionFence.current.blur();
      targetRouteFence.current.blur();
    };
  }, [accountRoute, deferredAttempt?.reference, id, load, reference, session?.user.id]));

  useStaggeredArrivals(wall?.id, (mark) => {
    dropIds.current.add(mark.id);
    setMarks((current) => mergeWallMarks(current, [mark]));
  });
  const gridMarks = focusedMark?.secret ? marks.filter((mark) => mark.id !== focusedMark.id) : marks;
  const reactionMarks = useMemo(
    () => focusedMark && !marks.some((mark) => mark.id === focusedMark.id) ? [...marks, focusedMark] : marks,
    [focusedMark, marks],
  );
  const { summaries, toggle } = useWallReactions(reactionMarks, session?.user.id);
  const canLeaveMark = capabilities?.canContribute === true;
  const wallAvailability = classifyOtherWallAvailability({
    readFailed: Boolean(error),
    hasReadableWall: Boolean(wall),
    hasCapabilities: Boolean(capabilities),
  });

  async function toggleFollow() {
    const viewerId = session?.user.id ?? null;
    if (!profile || !wall || wall.visibility !== "public" || !followStateAvailable || actionInFlight.current) return;
    const targetToken = targetRouteFence.current.capture(profile.id);
    const token = actionFence.current.begin(viewerId);
    if (!token || !targetToken) return;
    actionInFlight.current = true;
    const previous = following;
    setFollowBusy(true);
    try {
      if (previous) await unfollowUser(token.userId, profile.id);
      else await followUser(token.userId, profile.id);
      if (!actionFence.current.isCurrent(token, currentUserId.current)
        || !targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) return;
      setFollowing(!previous);
      try {
        const nextCounts = await getFollowCounts(profile.id);
        if (actionFence.current.isCurrent(token, currentUserId.current)
          && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
          setCounts((current) => current ? { ...current, ...nextCounts } : null);
        }
      } catch {
        if (actionFence.current.isCurrent(token, currentUserId.current)
          && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
          setCounts(null);
          Alert.alert("Follow updated", "The count couldn't refresh yet. Reopen this Wall to try again.");
        }
      }
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        Alert.alert("Couldn't update that", cause?.message ?? "Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        actionInFlight.current = false;
        setFollowBusy(false);
      }
    }
  }

  async function performRelationship(kind: FriendActionKind, expectedPersonId: string) {
    const viewerId = session?.user.id ?? null;
    if (!profile || profile.id !== expectedPersonId || currentPersonId.current !== expectedPersonId || actionInFlight.current) return;
    const targetToken = targetRouteFence.current.capture(expectedPersonId);
    const token = actionFence.current.begin(viewerId);
    if (!token || !targetToken) return;
    actionInFlight.current = true;
    setRelationshipBusy(true);
    try {
      switch (kind) {
        case "send": await sendFriendRequest(token.userId, expectedPersonId); break;
        case "accept": await acceptFriendRequest(token.userId, expectedPersonId); break;
        case "decline": await declineFriendRequest(token.userId, expectedPersonId); break;
        case "cancel": await cancelFriendRequest(token.userId, expectedPersonId); break;
        case "unfriend": await unfriend(token.userId, expectedPersonId); break;
      }
      if (!actionFence.current.isCurrent(token, currentUserId.current)
        || !targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) return;
      await load();
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        Alert.alert("Couldn't update that", cause?.message ?? "Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        actionInFlight.current = false;
        setRelationshipBusy(false);
      }
    }
  }

  function requestRelationshipAction(kind: FriendActionKind) {
    const targetId = profile?.id;
    if (!targetId) return;
    if (kind !== "unfriend") {
      void performRelationship(kind, targetId);
      return;
    }
    const confirmationTarget = targetRouteFence.current.capture(targetId);
    if (!confirmationTarget) return;
    Alert.alert(`Unfriend ${profile.display_name}?`, "Private Walls and friends-only Mark access will no longer be available.", [
      { text: "Keep friend", style: "cancel" },
      {
        text: "Unfriend",
        style: "destructive",
        onPress: () => {
          if (targetRouteFence.current.isCurrent(confirmationTarget, currentPersonId.current)) {
            void performRelationship(kind, targetId);
          }
        },
      },
    ]);
  }

  function confirmBlock() {
    if (!profile || safetyBusy || actionInFlight.current) return;
    const targetId = profile.id;
    const targetToken = targetRouteFence.current.capture(targetId);
    const subjectToken = actionFence.current.begin(currentUserId.current);
    if (!targetToken || !subjectToken) return;
    Alert.alert(
      `Block @${profile.handle}?`,
      "You will no longer be able to interact, and existing social connections will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => void performBlock(targetId, subjectToken, targetToken),
        },
      ],
    );
  }

  async function performBlock(
    targetId: string,
    subjectToken: NonNullable<ReturnType<SessionFocusFence["begin"]>>,
    targetToken: NonNullable<ReturnType<TargetRouteFence["capture"]>>,
  ) {
    if (actionInFlight.current
      || !actionFence.current.isCurrent(subjectToken, currentUserId.current)
      || !targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) return;
    actionInFlight.current = true;
    setSafetyBusy(true);
    try {
      await blockUser(subjectToken.userId, targetId);
      if (!actionFence.current.isCurrent(subjectToken, currentUserId.current)
        || !targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) return;
      setBlockedByMe(true);
      setProfile(null);
      setWall(null);
      setMarks([]);
      setCapabilities(null);
      setCounts(null);
      setFollowing(false);
      setRelationship("none");
    } catch (cause: any) {
      if (actionFence.current.isCurrent(subjectToken, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        Alert.alert("Couldn't block them", cause?.message ?? "Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(subjectToken, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        actionInFlight.current = false;
        setSafetyBusy(false);
      }
    }
  }

  async function performUnblock() {
    const targetId = typeof id === "string" ? id : null;
    if (!targetId || safetyBusy || actionInFlight.current) return;
    const targetToken = targetRouteFence.current.capture(targetId);
    const subjectToken = actionFence.current.begin(currentUserId.current);
    if (!targetToken || !subjectToken) return;
    actionInFlight.current = true;
    setSafetyBusy(true);
    try {
      await unblockUser(subjectToken.userId, targetId);
      if (!actionFence.current.isCurrent(subjectToken, currentUserId.current)
        || !targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) return;
      setBlockedByMe(false);
      await load();
    } catch (cause: any) {
      if (actionFence.current.isCurrent(subjectToken, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        Alert.alert("Couldn't unblock them", cause?.message ?? "Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(subjectToken, currentUserId.current)
        && targetRouteFence.current.isCurrent(targetToken, currentPersonId.current)) {
        actionInFlight.current = false;
        setSafetyBusy(false);
      }
    }
  }

  async function retryLoad() {
    const captured = deferredAttempt?.token ?? null;
    if (captured && !await retryDeferredDestination(captured)) return;
    await load();
  }

  async function loadOlder() {
    const viewerId = session?.user.id ?? null;
    const personId = typeof id === "string" ? id : null;
    if (!viewerId || !personId || !wall || !nextCursor || olderBusy) return;
    const generation = pageGeneration.current;
    const requestedWall = wall.id;
    setOlderBusy(true); setOlderError(false);
    try {
      const page = await listWallMarks(requestedWall, nextCursor);
      if (generation !== pageGeneration.current || currentUserId.current !== viewerId || currentPersonId.current !== personId) return;
      setMarks((current) => mergeWallMarks(current, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      if (generation === pageGeneration.current && currentUserId.current === viewerId) setOlderError(true);
    } finally {
      if (generation === pageGeneration.current) setOlderBusy(false);
    }
  }

  if (authLoading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;
  if (loadedIdentity && loadedIdentity !== `${session?.user.id}:${String(id ?? "")}:${focusMarkId ?? ""}`) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} /></Screen>;
  if (reference && deferredAttempt?.reference !== reference) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  if (reference && deferredAttempt?.reference === reference && !deferredAttempt.token) return <Redirect href="/(tabs)/home" />;
  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      {blockedByMe ? (
        <View style={{ paddingVertical: 32, gap: 12 }}>
          <Text variant="headline">You blocked this person.</Text>
          <Text variant="body" color={colors.outline}>Their profile and Personal Wall are hidden. Unblocking does not restore earlier friendships or follows.</Text>
          <Button label="Unblock" variant="ghost" loading={safetyBusy} onPress={() => void performUnblock()} />
        </View>
      ) : error || !profile ? (
        <View>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{error ?? "This person isn't available."}</Text>
          <View style={{ marginTop: 16, alignSelf: "flex-start" }}>
            <Button label="Try again" variant="ghost" onPress={() => void retryLoad()} />
          </View>
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: colors.ink, padding: 10, borderRadius: radius.card, marginBottom: 16 }}>
            <Text variant="label" color={markColors.brandYellow} style={{ textAlign: "center" }}>THIS IS @{profile.handle.toUpperCase()}'S WALL</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <View style={{ width: 58, height: 58, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: markColors.brandYellow, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} /> : <Text variant="display">{profile.display_name[0]?.toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="display" style={{ fontSize: 24 }}>{profile.display_name}</Text>
              <Text variant="body" color={colors.outline}>@{profile.handle}</Text>
            </View>
          </View>
          <Text variant="body" color={colors.outline} style={{ marginTop: -8, marginBottom: 14 }}>
            {relationship === "friends" ? "Friends" : relationship === "incoming" ? "Sent you a friend request" : relationship === "outgoing" ? "Friend request sent" : "Not friends"}
          </Text>
          {counts ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 16 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${counts.followers} followers. Open followers list.`} onPress={() => router.push(`/social/followers?userId=${profile.id}`)} style={{ minHeight: 44, justifyContent: "center", paddingRight: 12 }}>
                <Text variant="label" color={colors.onSurfaceVariant}>{counts.followers} FOLLOWERS</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${counts.following} following. Open following list.`} onPress={() => router.push(`/social/following?userId=${profile.id}`)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}>
                <Text variant="label" color={colors.onSurfaceVariant}>{counts.following} FOLLOWING</Text>
              </Pressable>
              <Text variant="label" color={colors.onSurfaceVariant} style={{ minHeight: 44, textAlignVertical: "center", paddingLeft: 12 }}>{counts.publicWalls} PUBLIC WALLS</Text>
            </View>
          ) : socialDetailsUnavailable ? (
            <Pressable accessibilityRole="button" onPress={() => void retryLoad()} style={{ minHeight: 44, justifyContent: "center", marginBottom: 16 }}>
              <Text accessibilityRole="alert" variant="body" color={colors.outline}>Social counts aren&apos;t available right now. Tap to retry.</Text>
            </Pressable>
          ) : null}
          {profile.bio ? <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: -6, marginBottom: 18 }}>{profile.bio}</Text> : null}
          {wall && capabilities ? <WallStatus wallId={wall.id} viewerId={session?.user.id} /> : null}
          {focusedMarkUnavailable ? <Text accessibilityRole="alert" variant="body" color={colors.outline} style={{ marginBottom: 18 }}>This Mark isn&apos;t available anymore.</Text> : null}
          <View style={{ marginBottom: 18 }}><SocialLinks profile={profile} /></View>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            {friendActionsFor(relationship).map((action) => (
              <Button key={action.kind} label={action.label} variant={action.kind === "accept" || action.kind === "send" ? "yellow" : "ghost"} disabled={relationshipBusy || safetyBusy} loading={relationshipBusy && friendActionsFor(relationship).length === 1} onPress={() => requestRelationshipAction(action.kind)} />
            ))}
            <Button label="Report" variant="ghost" disabled={safetyBusy} onPress={() => router.push(`/report-user/${profile.id}`)} />
            <Button label="Block" variant="ghost" loading={safetyBusy} onPress={confirmBlock} />
          </View>

          {wallAvailability !== "available" || !wall || !capabilities ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <Text variant="headline">{wallAvailability === "private" ? "This Wall is private." : "This Wall isn't available."}</Text>
              <Text variant="body" color={colors.outline} style={{ marginTop: 8, textAlign: "center" }}>
                {wallAvailability === "private"
                  ? relationship === "outgoing" ? "They need to accept your request before you can view it." : "Become friends to view this Wall."
                  : "Go back or try again in a moment."}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: canLeaveMark ? 24 : 12 }}>
                {canLeaveMark ? <Button label={`Leave a Mark for @${profile.handle}`} variant="yellow" onPress={() => router.push(`/create?wallId=${wall.id}&recipientId=${profile.id}&handle=${encodeURIComponent(profile.handle)}`)} /> : null}
                <Button label="Share ↗" variant="primary" onPress={() => sharePersonWall(profile.handle, profile.display_name)} />
                {wall.visibility === "public" ? <Button label={followStateAvailable ? (following ? "Following ✓" : "Follow") : "Follow unavailable"} variant={following ? "ghost" : "primary"} disabled={!followStateAvailable} loading={followBusy} onPress={toggleFollow} /> : null}
              </View>
              {wall.visibility === "public" && !followStateAvailable ? (
                <Pressable accessibilityRole="button" onPress={() => void retryLoad()} style={{ minHeight: 44, justifyContent: "center", marginTop: -8, marginBottom: 12 }}>
                  <Text accessibilityRole="alert" variant="body" color={colors.outline}>Follow status is unavailable. Tap to retry.</Text>
                </Pressable>
              ) : null}
              {!canLeaveMark ? <Text variant="body" color={colors.outline} style={{ marginBottom: 24 }}>{contributionUnavailableCopy(wall.contribution_policy, relationship)}</Text> : null}
              <Text variant="label" color={colors.outlineVariant}>{gridMarks.length} {nextCursor ? "LOADED MARKS" : "MARKS"}</Text>
              {focusedMark && (focusedMark.secret || !marks.some((mark) => mark.id === focusedMark.id)) ? (
                <View style={{ marginBottom: 16 }}>
                  <Text variant="label">LINKED MARK</Text>
                  <MarkView mark={focusedMark} highlight reactions={summaries[focusedMark.id]} onToggleReaction={(emoji) => toggle(focusedMark.id, emoji)} onOpenDetail={focusedMark.secret ? undefined : () => setSelectedMark(focusedMark)} />
                </View>
              ) : null}
              {marks.length ? (
                <Masonry data={gridMarks} keyFor={(mark) => mark.id} estimate={estimateMarkHeight} renderItem={(mark, index) => (
                  <MarkView mark={mark} enter={dropIds.current.has(mark.id) ? "drop" : "settle"} enterIndex={index} highlight={mark.id === justCreatedId} reactions={summaries[mark.id]} onToggleReaction={(emoji) => toggle(mark.id, emoji)} onOpenDetail={() => setSelectedMark(mark)} />
                )} />
              ) : (
                <View style={{ paddingVertical: 36, alignItems: "center" }}>
                  <Text variant="headline">No Marks yet</Text>
                  <Text variant="body" color={colors.outline} style={{ marginTop: 6 }}>Their Wall is waiting for its first story.</Text>
                </View>
              )}
              {nextCursor ? (
                <View style={{ marginTop: 20, gap: 8 }}>
                  {olderError ? <Text accessibilityRole="alert" variant="body" color={colors.error}>Older Marks couldn&apos;t load. Your visible Marks are still here.</Text> : null}
                  <Button label={olderError ? "Retry older Marks" : "Load older Marks"} variant="primary" loading={olderBusy} onPress={() => void loadOlder()} />
                </View>
              ) : null}
              <MarkDetailModal
                mark={selectedMark}
                viewerId={session?.user.id}
                wallOwnerId={wall.owner_id}
                wallHandle={profile.handle}
                reactions={selectedMark ? summaries[selectedMark.id] : undefined}
                onToggleReaction={selectedMark ? (emoji) => toggle(selectedMark.id, emoji) : undefined}
                onClose={() => setSelectedMark(null)}
                onMarkUpdated={(markId, text) => {
                  setMarks((current) => current.map((item) => item.id === markId ? { ...item, text } : item));
                  setSelectedMark((current) => current?.id === markId ? { ...current, text } : current);
                  setFocusedMark((current) => current?.id === markId ? { ...current, text } : current);
                }}
                onMarkRemoved={() => void load()}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
