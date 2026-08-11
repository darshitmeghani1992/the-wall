import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Input } from "@/components/Input";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { getFriends, searchPeople, type PersonRelationship } from "@/lib/friendships";
import { colors, markColors } from "@/theme";

export default function PeoplePicker() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getFriends(userId)
      .then(setPeople)
      .catch((cause: any) => setError(cause?.message ?? "Couldn't load your friends."))
      .finally(() => setLoading(false));
  }, [userId]);

  async function search() {
    if (!userId || !query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchPeople(userId, query);
      setPeople(results.filter((person) => person.relationship === "friends"));
    } catch (cause: any) {
      setError(cause?.message ?? "Search didn't work. Try again.");
    } finally {
      setLoading(false);
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
      {error ? <Text variant="body" color={colors.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 28 }} /> : people.length ? (
        <View style={{ marginTop: 12 }}>
          {people.map(({ profile }) => (
            <PersonRow key={profile.id} profile={profile} onPress={() => router.push(`/person/${profile.id}`)} />
          ))}
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
