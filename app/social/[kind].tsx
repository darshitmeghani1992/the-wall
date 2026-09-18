import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { getFollowers, getFollowing } from "@/lib/follows";
import { SessionFocusFence } from "@/lib/session-generation";
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
  const loadFence = useRef(new SessionFocusFence());
  const currentUserId = useRef<string | null>(session?.user.id ?? null);
  const currentTargetId = useRef<string | null>(targetId ?? null);
  currentUserId.current = session?.user.id ?? null;
  currentTargetId.current = targetId ?? null;

  const load = useCallback(async () => {
    const token = loadFence.current.begin(session?.user.id ?? null);
    const requestedTargetId = targetId;
    if (!token || !requestedTargetId || (kind !== "followers" && kind !== "following")) {
      setError("This list isn't available.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = followersMode ? await getFollowers(requestedTargetId) : await getFollowing(requestedTargetId);
      if (!loadFence.current.isCurrent(token, currentUserId.current) || currentTargetId.current !== requestedTargetId) return;
      setPeople(next);
    } catch (cause: any) {
      if (loadFence.current.isCurrent(token, currentUserId.current) && currentTargetId.current === requestedTargetId) {
        setError(cause?.message ?? "Couldn't load this list.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentUserId.current) && currentTargetId.current === requestedTargetId) {
        setLoading(false);
      }
    }
  }, [followersMode, kind, session?.user.id, targetId]);

  useFocusEffect(useCallback(() => {
    loadFence.current.focus(session?.user.id ?? null);
    void load();
    return () => {
      loadFence.current.blur();
      setPeople([]);
      setError(null);
    };
  }, [load, session?.user.id]));

  return (
    <Screen dockInset={false}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: 8, marginBottom: 20 }}>{title}</Text>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : error ? (
        <View>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text>
          <View style={{ marginTop: 16, alignSelf: "flex-start" }}>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text variant="label">TRY AGAIN</Text>
            </Pressable>
          </View>
        </View>
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
