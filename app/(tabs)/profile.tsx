import { View } from "react-native";
import { Image } from "expo-image";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

/** Profile — real user identity + sign-out. Stats/edit expand in Phase 4. */
export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const initial = (profile?.display_name?.[0] ?? "?").toUpperCase();

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
            // Neutral avatar tile — brandYellow is reserved for Invite (VD §3).
            backgroundColor: colors.surfaceContainerHigh,
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
        {profile?.bio ? (
          <Text variant="body" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            {profile.bio}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <Button label="Edit profile" variant="ghost" onPress={() => {}} />
        <Button label="Sign out" variant="primary" onPress={signOut} />
      </View>
    </Screen>
  );
}
