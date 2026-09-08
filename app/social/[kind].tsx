import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { getFollowers, getFollowing } from "@/lib/follows";
import type { Profile } from "@/lib/types";
import { colors, markColors } from "@/theme";

export default function SocialListScreen() {
  const router = useRouter();
  const { kind, userId } = useLocalSearchParams<{ kind: string; userId?: string }>();
  const { session } = useAuth();
  const targetId = userId ?? session?.user.id;
  const followersMode = kind === "followers";
  const title = followersMode ? "Followers" : "Following";
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!targetId || (kind !== "followers" && kind !== "following")) {
        setError("This list isn't available.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = followersMode ? await getFollowers(targetId) : await getFollowing(targetId);
        if (active) setPeople(next);
      } catch (cause: any) {
        if (active) setError(cause?.message ?? "Couldn't load this list.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [followersMode, kind, targetId]);

  return (
    <Screen dockInset={false}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: 8, marginBottom: 20 }}>{title}</Text>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text variant="body" color={colors.error}>{error}</Text>
      ) : people.length ? (
        <View>
          {people.map((profile) => (
            <PersonRow
              key={profile.id}
              profile={profile}
              onPress={() => profile.id === session?.user.id ? router.push("/profile") : router.push(`/person/${profile.id}`)}
            />
          ))}
        </View>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text variant="headline">No one here yet</Text>
          <Text variant="body" color={colors.outline} style={{ marginTop: 6, textAlign: "center" }}>
            {followersMode ? "Share your Wall to help people find you." : "Visit public Walls and follow people you care about."}
          </Text>
        </View>
      )}
    </Screen>
  );
}
