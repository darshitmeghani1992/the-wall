import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Input } from "@/components/Input";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriends,
  getIncomingRequests,
  searchPeople,
  sendFriendRequest,
  unfriend,
  type PersonRelationship,
} from "@/lib/friendships";
import { followUser, unfollowUser } from "@/lib/follows";
import { useAuth } from "@/lib/auth";
import { friendActionsFor, normalizePeopleSearchQuery, type FriendActionKind } from "@/lib/relationship-ui";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, markColors } from "@/theme";

export default function PeopleScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonRelationship[]>([]);
  const [friends, setFriends] = useState<PersonRelationship[]>([]);
  const [incoming, setIncoming] = useState<PersonRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(userId ?? null);
  const currentQuery = useRef(query);
  const networkFence = useRef(new SessionFocusFence());
  const searchFence = useRef(new SessionFocusFence());
  const actionFence = useRef(new SessionFocusFence());
  const actionInFlight = useRef(false);
  currentUserId.current = userId ?? null;
  currentQuery.current = query;

  const loadNetwork = useCallback(async () => {
    const token = networkFence.current.begin(userId ?? null);
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [nextFriends, nextIncoming] = await Promise.all([
        getFriends(token.userId),
        getIncomingRequests(token.userId),
      ]);
      if (!networkFence.current.isCurrent(token, currentUserId.current)) return;
      setFriends(nextFriends);
      setIncoming(nextIncoming);
    } catch (cause: any) {
      if (networkFence.current.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't load your people.");
      }
    } finally {
      if (networkFence.current.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    const nextUserId = userId ?? null;
    networkFence.current.focus(nextUserId);
    searchFence.current.focus(nextUserId);
    actionFence.current.focus(nextUserId);
    setBusyId(null);
    setSearching(false);
    setError(null);
    setResults([]);
    setSearchedQuery(null);
    setFriends([]);
    setIncoming([]);
    actionInFlight.current = false;
    if (nextUserId) void loadNetwork();
    else setLoading(false);
    return () => {
      networkFence.current.blur();
      searchFence.current.blur();
      actionFence.current.blur();
    };
  }, [loadNetwork, userId]));

  async function runSearch() {
    const normalized = normalizePeopleSearchQuery(query);
    const token = searchFence.current.begin(userId ?? null);
    if (!token || !normalized) {
      setResults([]);
      setSearchedQuery(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const nextResults = await searchPeople(userId!, normalized);
      if (!searchFence.current.isCurrent(token, currentUserId.current)) return;
      if (normalizePeopleSearchQuery(currentQuery.current) !== normalized) return;
      setResults(nextResults);
      setSearchedQuery(normalized);
    } catch (cause: any) {
      if (searchFence.current.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Search didn't work. Try again.");
      }
    } finally {
      if (searchFence.current.isCurrent(token, currentUserId.current)) setSearching(false);
    }
  }

  async function perform(personId: string, action: () => Promise<void>) {
    if (actionInFlight.current) return;
    const token = actionFence.current.begin(userId ?? null);
    if (!token) return;
    actionInFlight.current = true;
    setBusyId(personId);
    let actionSucceeded = false;
    try {
      await action();
      actionSucceeded = true;
      if (!actionFence.current.isCurrent(token, currentUserId.current)) return;
      await loadNetwork();
      const normalized = normalizePeopleSearchQuery(currentQuery.current);
      if (normalized) {
        const nextResults = await searchPeople(userId!, normalized);
        if (actionFence.current.isCurrent(token, currentUserId.current)
          && normalizePeopleSearchQuery(currentQuery.current) === normalized) {
          setResults(nextResults);
          setSearchedQuery(normalized);
        }
      }
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentUserId.current)) {
        Alert.alert(
          actionSucceeded ? "Updated, but couldn't refresh" : "Couldn't update that",
          actionSucceeded ? "The change was saved. Pull away and return to refresh this screen." : cause?.message ?? "Please try again.",
        );
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentUserId.current)) {
        actionInFlight.current = false;
        setBusyId(null);
      }
    }
  }

  function confirmUnfriend(profile: PersonRelationship["profile"], action: () => void) {
    Alert.alert(
      `Unfriend ${profile.display_name}?`,
      "Private Walls and friends-only Mark access will no longer be available.",
      [{ text: "Keep friend", style: "cancel" }, { text: "Unfriend", style: "destructive", onPress: action }],
    );
  }

  function runFriendAction(person: PersonRelationship, kind: FriendActionKind) {
    if (!userId) return;
    const action = () => perform(person.profile.id, () => {
      switch (kind) {
        case "send": return sendFriendRequest(userId, person.profile.id);
        case "accept": return acceptFriendRequest(userId, person.profile.id);
        case "decline": return declineFriendRequest(userId, person.profile.id);
        case "cancel": return cancelFriendRequest(userId, person.profile.id);
        case "unfriend": return unfriend(userId, person.profile.id);
      }
    });
    if (kind === "unfriend") confirmUnfriend(person.profile, action);
    else void action();
  }

  function runFollowAction(person: PersonRelationship) {
    if (!userId) return;
    void perform(person.profile.id, () => person.follow === "following"
      ? unfollowUser(userId, person.profile.id)
      : followUser(userId, person.profile.id));
  }

  function openWall(personId: string) {
    router.push(`/person/${personId}`);
  }

  return (
    <Screen>
      <Text variant="display" style={{ marginTop: 20 }}>People</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 4, marginBottom: 18 }}>
        Find your people, then visit their Walls.
      </Text>

      <Input
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          currentQuery.current = value;
          searchFence.current.focus(userId ?? null);
          setSearching(false);
          setSearchedQuery(null);
          setResults([]);
        }}
        onSubmitEditing={runSearch}
        placeholder="name or handle"
        accessibilityLabel="Search people by name or handle"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search people"
        accessibilityState={{ disabled: !query.trim() || searching, busy: searching }}
        onPress={runSearch}
        disabled={!query.trim() || searching}
        style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
      >
        {searching ? <ActivityIndicator color={markColors.brandYellow} /> : <Text variant="label">SEARCH</Text>}
      </Pressable>

      {error ? <Text variant="body" color={colors.error} style={{ marginBottom: 12 }}>{error}</Text> : null}

      {results.length ? (
        <View style={{ marginBottom: 20 }}>
          <Text variant="label" color={colors.outline}>SEARCH RESULTS</Text>
          {results.map((person) => {
            const { profile } = person;
            const actions = friendActionsFor(person.relationship);
            const first = actions[0];
            const second = actions[1];
            const followLabel = person.follow === "following" ? "Following" : person.follow === "not_following" ? "Follow" : undefined;
            return (
              <PersonRow
                key={profile.id}
                profile={profile}
                detail={person.relationship === "friends" ? "Friends" : person.relationship === "incoming" ? "Wants to connect" : person.relationship === "outgoing" ? "Requested" : undefined}
                action={first?.label}
                secondaryAction={second?.label ?? followLabel}
                disabled={busyId === profile.id}
                secondaryDisabled={busyId === profile.id}
                onPress={() => openWall(profile.id)}
                onAction={first ? () => runFriendAction(person, first.kind) : undefined}
                onSecondaryAction={second
                  ? () => runFriendAction(person, second.kind)
                  : followLabel ? () => runFollowAction(person) : undefined}
              />
            );
          })}
        </View>
      ) : searchedQuery && !searching ? (
        <Text variant="body" color={colors.outline} style={{ marginBottom: 20 }}>No people found for “{searchedQuery}”.</Text>
      ) : null}

      {loading ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 24 }} /> : (
        <>
          {incoming.length ? (
            <View style={{ marginBottom: 24 }}>
              <Text variant="label" color={colors.outline}>REQUESTS · {incoming.length}</Text>
              {incoming.map((person) => (
                <View key={person.profile.id}>
                  <PersonRow
                    profile={person.profile}
                    detail="Wants to connect"
                    action="Accept"
                    secondaryAction="Decline"
                    disabled={busyId === person.profile.id}
                    secondaryDisabled={busyId === person.profile.id}
                    onPress={() => openWall(person.profile.id)}
                    onAction={() => runFriendAction(person, "accept")}
                    onSecondaryAction={() => runFriendAction(person, "decline")}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Text variant="label" color={colors.outline}>FRIENDS · {friends.length}</Text>
          {friends.length ? friends.map((person) => (
            <PersonRow
              key={person.profile.id}
              profile={person.profile}
              detail="Friends"
              action="Unfriend"
              secondaryAction={person.follow === "following" ? "Following" : person.follow === "not_following" ? "Follow" : undefined}
              disabled={busyId === person.profile.id}
              secondaryDisabled={busyId === person.profile.id}
              onPress={() => openWall(person.profile.id)}
              onAction={() => runFriendAction(person, "unfriend")}
              onSecondaryAction={person.follow !== "unavailable" ? () => runFollowAction(person) : undefined}
            />
          )) : (
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 12 }}>
              No friends here yet. Search a handle to find someone.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
