import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { SocialLinks } from "@/components/SocialLinks";
import { useAuth } from "@/lib/auth";
import { getFollowCounts } from "@/lib/follows";
import { getFriends } from "@/lib/friendships";
import { SessionFocusFence } from "@/lib/session-generation";
import { shareMyWall } from "@/lib/share";
import { colors, markColors } from "@/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [countsLoading, setCountsLoading] = useState(false);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [friendCountLoading, setFriendCountLoading] = useState(false);
  const [friendCountError, setFriendCountError] = useState(false);
  const [countsError, setCountsError] = useState(false);
  const countsFence = useRef(new SessionFocusFence());
  const friendFence = useRef(new SessionFocusFence());
  const currentUserId = useRef<string | null>(session?.user.id ?? null);
  currentUserId.current = session?.user.id ?? null;
  const initial = (profile?.display_name?.[0] ?? "?").toUpperCase();

  const refreshCounts = useCallback(async () => {
    const token = countsFence.current.begin(session?.user.id ?? null);
    if (!token) return;
    setCountsLoading(true);
    setCountsError(false);
    try {
      const next = await getFollowCounts(token.userId);
      if (!countsFence.current.isCurrent(token, currentUserId.current)) return;
      setFollowers(next.followers);
      setFollowing(next.following);
    } catch {
      if (countsFence.current.isCurrent(token, currentUserId.current)) setCountsError(true);
    } finally {
      if (countsFence.current.isCurrent(token, currentUserId.current)) setCountsLoading(false);
    }
  }, [session?.user.id]);

  const refreshFriends = useCallback(async () => {
    const token = friendFence.current.begin(session?.user.id ?? null);
    if (!token) return;
    setFriendCountLoading(true);
    setFriendCountError(false);
    try {
      const people = await getFriends(token.userId);
      if (!friendFence.current.isCurrent(token, currentUserId.current)) return;
      setFriendCount(people.length);
    } catch {
      if (friendFence.current.isCurrent(token, currentUserId.current)) setFriendCountError(true);
    } finally {
      if (friendFence.current.isCurrent(token, currentUserId.current)) setFriendCountLoading(false);
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => {
    const userId = session?.user.id ?? null;
    countsFence.current.focus(userId);
    friendFence.current.focus(userId);
    setFriendCount(null);
    void refreshCounts();
    void refreshFriends();
    return () => {
      countsFence.current.blur();
      friendFence.current.blur();
    };
  }, [refreshCounts, refreshFriends, session?.user.id]));

  return (
    <Screen>
      <Text variant="display" style={{ marginVertical: 20 }}>Profile</Text>

      <View style={{ alignItems: "center", gap: 10, marginBottom: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: markColors.brandYellow, alignItems: "center", justifyContent: "center", overflow: "hidden", transform: [{ rotate: "-3deg" }] }}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text variant="display" style={{ fontSize: 40 }}>{initial}</Text>
          )}
        </View>
        <Text variant="display" style={{ fontSize: 24 }}>{profile?.display_name ?? "You"}</Text>
        {profile?.handle ? <Text variant="label" color={colors.outline}>@{profile.handle}</Text> : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 26, marginTop: 4 }}>
          {countsLoading ? <ActivityIndicator color={markColors.brandYellow} /> : countsError ? (
            <Pressable accessibilityRole="button" onPress={() => void refreshCounts()} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text accessibilityRole="alert" variant="label" color={colors.error}>COUNTS UNAVAILABLE · RETRY</Text>
            </Pressable>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={`${followers} followers. Open followers list.`} onPress={() => router.push("/social/followers")} style={{ alignItems: "center", minWidth: 76, minHeight: 44, justifyContent: "center" }}>
                <Text variant="headline">{followers}</Text>
                <Text variant="label" color={colors.outline}>FOLLOWERS</Text>
              </Pressable>
              <View style={{ width: 1, height: 30, backgroundColor: colors.outline, opacity: 0.35 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${following} following. Open following list.`} onPress={() => router.push("/social/following")} style={{ alignItems: "center", minWidth: 76, minHeight: 44, justifyContent: "center" }}>
                <Text variant="headline">{following}</Text>
                <Text variant="label" color={colors.outline}>FOLLOWING</Text>
              </Pressable>
            </>
          )}
        </View>

        {friendCountLoading ? <ActivityIndicator color={markColors.brandYellow} /> : friendCountError ? (
          <Pressable accessibilityRole="button" onPress={() => void refreshFriends()} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text accessibilityRole="alert" variant="label" color={colors.error}>FRIENDS UNAVAILABLE · RETRY</Text>
          </Pressable>
        ) : friendCount !== null ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${friendCount} friends. Open friends in Discover.`} onPress={() => router.push({ pathname: "/(tabs)/discover", params: { section: "friends" } })} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text variant="label" color={colors.outline}>FRIENDS · {friendCount}</Text>
          </Pressable>
        ) : null}

        {profile?.bio ? <Text variant="body" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>{profile.bio}</Text> : null}
        {profile ? <SocialLinks profile={profile} /> : null}
      </View>

      <View style={{ gap: 12 }}>
        <Button label="Share my Wall" variant="yellow" onPress={() => shareMyWall(profile?.handle)} />
        <Button label="Edit profile" variant="ghost" onPress={() => router.push("/profile-edit")} />
        <Button label="Help" variant="ghost" onPress={() => router.push("/help")} />
        <Button label="Settings" variant="primary" onPress={() => router.push("/settings")} />
      </View>
    </Screen>
  );
}
