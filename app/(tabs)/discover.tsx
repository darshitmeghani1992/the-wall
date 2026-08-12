import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Input } from "@/components/Input";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getIncomingRequests,
  searchPeople,
  sendFriendRequest,
  type PersonRelationship,
} from "@/lib/friendships";
import { useAuth } from "@/lib/auth";
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
  const [error, setError] = useState<string | null>(null);

  const loadNetwork = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextFriends, nextIncoming] = await Promise.all([
        getFriends(userId),
        getIncomingRequests(userId),
      ]);
      setFriends(nextFriends);
      setIncoming(nextIncoming);
    } catch (cause: any) {
      setError(cause?.message ?? "Couldn't load your people.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadNetwork(); }, [loadNetwork]));

  async function runSearch() {
    if (!userId || !query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchPeople(userId, query));
    } catch (cause: any) {
      setError(cause?.message ?? "Search didn't work. Try again.");
    } finally {
      setSearching(false);
    }
  }

  async function perform(personId: string, action: () => Promise<void>) {
    setBusyId(personId);
    try {
      await action();
      await loadNetwork();
      if (query.trim() && userId) setResults(await searchPeople(userId, query));
    } catch (cause: any) {
      Alert.alert("Couldn't update that", cause?.message ?? "Please try again.");
    } finally {
      setBusyId(null);
    }
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
        prefix="@"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={runSearch}
        placeholder="handle"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <Pressable
        accessibilityRole="button"
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
          {results.map(({ profile, relationship }) => {
            const label = relationship === "none" ? "Add friend" : relationship === "outgoing" ? "Sent" : relationship === "incoming" ? "Accept" : "Friends";
            return (
              <PersonRow
                key={profile.id}
                profile={profile}
                action={label}
                disabled={busyId === profile.id || relationship === "outgoing" || relationship === "friends"}
                onPress={relationship === "friends" ? () => openWall(profile.id) : undefined}
                onAction={relationship === "none"
                  ? () => perform(profile.id, () => sendFriendRequest(userId!, profile.id))
                  : relationship === "incoming"
                    ? () => perform(profile.id, () => acceptFriendRequest(userId!, profile.id))
                    : undefined}
              />
            );
          })}
        </View>
      ) : query.trim() && !searching ? (
        <Text variant="body" color={colors.outline} style={{ marginBottom: 20 }}>No people found for @{query.replace(/^@/, "")}.</Text>
      ) : null}

      {loading ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 24 }} /> : (
        <>
          {incoming.length ? (
            <View style={{ marginBottom: 24 }}>
              <Text variant="label" color={colors.outline}>REQUESTS · {incoming.length}</Text>
              {incoming.map(({ profile }) => (
                <View key={profile.id}>
                  <PersonRow
                    profile={profile}
                    action="Accept"
                    disabled={busyId === profile.id}
                    onAction={() => perform(profile.id, () => acceptFriendRequest(userId!, profile.id))}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => perform(profile.id, () => declineFriendRequest(userId!, profile.id))}
                    disabled={busyId === profile.id}
                    style={{ alignSelf: "flex-end", minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}
                  >
                    <Text variant="label" color={colors.outline}>DECLINE</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Text variant="label" color={colors.outline}>FRIENDS · {friends.length}</Text>
          {friends.length ? friends.map(({ profile }) => (
            <PersonRow key={profile.id} profile={profile} action="Friends" onPress={() => openWall(profile.id)} />
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
