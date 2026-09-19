import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Input } from "@/components/Input";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { getFriends, searchPeople, type PersonRelationship } from "@/lib/friendships";
import { getPersonalWall } from "@/lib/profiles";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, markColors } from "@/theme";

export default function PeoplePicker() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const loadFence = useRef(new SessionFocusFence());
  const actionFence = useRef(new SessionFocusFence());
  const currentUserId = useRef<string | null>(userId ?? null);
  const selectionInFlight = useRef(false);
  currentUserId.current = userId ?? null;

  const loadFriends = useCallback(async () => {
    const token = loadFence.current.begin(userId ?? null);
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getFriends(token.userId);
      if (loadFence.current.isCurrent(token, currentUserId.current)) setPeople(next);
    } catch (cause: any) {
      if (loadFence.current.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't load your friends.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    loadFence.current.focus(userId ?? null);
    actionFence.current.focus(userId ?? null);
    selectionInFlight.current = false;
    setSelectingId(null);
    if (userId) void loadFriends();
    else setLoading(false);
    return () => {
      loadFence.current.blur();
      actionFence.current.blur();
      selectionInFlight.current = false;
      setPeople([]);
      setError(null);
      setSelectingId(null);
    };
  }, [loadFriends, userId]));

  async function search() {
    const token = loadFence.current.begin(userId ?? null);
    if (!token || !query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchPeople(token.userId, query);
      if (loadFence.current.isCurrent(token, currentUserId.current)) {
        setPeople(results.filter((person) => person.relationship === "friends"));
      }
    } catch (cause: any) {
      if (loadFence.current.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Search didn't work. Try again.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }

  async function choosePerson(person: PersonRelationship["profile"]) {
    const token = actionFence.current.begin(userId ?? null);
    if (!token || selectionInFlight.current) return;
    selectionInFlight.current = true;
    setSelectingId(person.id);
    setError(null);
    try {
      const target = await getPersonalWall(person.id);
      if (!actionFence.current.isCurrent(token, currentUserId.current)) return;
      if (!target) {
        setError("That friend's Wall isn't available right now.");
        return;
      }
      router.replace(`/create?wallId=${target.id}&recipientId=${person.id}&handle=${encodeURIComponent(person.handle)}`);
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't open that Wall. Try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentUserId.current)) {
        selectionInFlight.current = false;
        setSelectingId(null);
      }
    }
  }

  return (
    <Screen dockInset={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 16 }}>
        <Text variant="display" style={{ fontSize: 25 }}>Who is this Mark for?</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text variant="label" color={colors.outline}>CLOSE</Text></Pressable>
      </View>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: 18 }}>
        Choose a friend. A Mark always belongs on their Wall.
      </Text>
      <Input
        prefix="@"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={search}
        placeholder="search friends"
        autoCapitalize="none"
        returnKeyType="search"
      />
      <Pressable onPress={search} disabled={!query.trim()} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}>
        <Text variant="label">SEARCH FRIENDS</Text>
      </Pressable>
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => void (query.trim() ? search() : loadFriends())} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{error} Tap to retry.</Text>
        </Pressable>
      ) : null}
      {loading ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 28 }} /> : people.length ? (
        <View style={{ marginTop: 12 }}>
          {people.map(({ profile }) => (
            <PersonRow
              key={profile.id}
              profile={profile}
              accessibilityLabel={`Write a Mark for @${profile.handle}`}
              onPress={selectingId ? undefined : () => void choosePerson(profile)}
            />
          ))}
          {selectingId ? <ActivityIndicator accessibilityLabel="Opening Wall" color={markColors.brandYellow} style={{ marginTop: 12 }} /> : null}
        </View>
      ) : (
        <View style={{ marginTop: 32, alignItems: "center" }}>
          <Text variant="headline">No friends to choose yet</Text>
          <Text variant="body" color={colors.outline} style={{ textAlign: "center", marginTop: 6 }}>
            Find and connect with someone in People first.
          </Text>
          <Pressable onPress={() => { router.dismissAll(); router.push("/(tabs)/discover"); }} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text variant="label">FIND PEOPLE →</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
