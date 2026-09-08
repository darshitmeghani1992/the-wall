import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { SocialLinks } from "@/components/SocialLinks";
import { useAuth } from "@/lib/auth";
import { getFollowCounts } from "@/lib/follows";
import { shareMyWall } from "@/lib/share";
import { colors, markColors } from "@/theme";

/** Profile — real user identity, social proof, edit, share-your-Wall, and sign-out. */
export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [countsLoading, setCountsLoading] = useState(false);
  const initial = (profile?.display_name?.[0] ?? "?").toUpperCase();

  const refreshCounts = useCallback(async () => {
    if (!profile?.id) return;
    setCountsLoading(true);
    try {
      const next = await getFollowCounts(profile.id);
      setFollowers(next.followers);
      setFollowing(next.following);
    } finally {
      setCountsLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { void refreshCounts(); }, [refreshCounts]));

  return (
    <Screen>
      <Text variant="display" style={{ marginVertical: 20 }}>
        Profile
      </Text>

      <View style={{ alignItems: "center", gap: 10, marginBottom: 24 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: markColors.brandYellow,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transform: [{ rotate: "-3deg" }],
          }}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text variant="display" style={{ fontSize: 40 }}>
              {initial}
            </Text>
          )}
        </View>
        <Text variant="display" style={{ fontSize: 24 }}>
          {profile?.display_name ?? "You"}
        </Text>
        {profile?.handle ? (
          <Text variant="label" color={colors.outline}>
            @{profile.handle}
          </Text>
        ) : null}

        <View
          accessibilityLabel={`${followers} followers, ${following} following`}
          style={{ flexDirection: "row", alignItems: "center", gap: 26, marginTop: 4 }}
        >
          {countsLoading ? (
            <ActivityIndicator color={markColors.brandYellow} />
          ) : (
            <>
              <View style={{ alignItems: "center" }}>
                <Text variant="headline">{followers}</Text>
                <Text variant="label" color={colors.outline}>FOLLOWERS</Text>
              </View>
              <View style={{ width: 1, height: 30, backgroundColor: colors.outline, opacity: 0.35 }} />
              <View style={{ alignItems: "center" }}>
                <Text variant="headline">{following}</Text>
                <Text variant="label" color={colors.outline}>FOLLOWING</Text>
              </View>
            </>
          )}
        </View>

        {profile?.bio ? (
          <Text variant="body" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            {profile.bio}
          </Text>
        ) : null}
        {profile ? <SocialLinks profile={profile} /> : null}
      </View>

      <View style={{ gap: 12 }}>
        <Button label="Share my Wall" variant="yellow" onPress={() => shareMyWall(profile?.handle)} />
        <Button label="Edit profile" variant="ghost" onPress={() => router.push("/profile-edit")} />
        <Button label="Sign out" variant="primary" onPress={signOut} />
      </View>
    </Screen>
  );
}
