import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { colors, markColors, radius, shadow, spacing } from "@/theme";

/** A small, honest way into the core loop: the user's Wall or their people. */
export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const firstName = profile?.display_name?.split(" ")[0] ?? "there";

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.gutter }}>
        <Text variant="display">the wall</Text>
        <Text variant="label" color={colors.outline}>// HOME</Text>
      </View>
      <Text variant="mark" style={{ marginTop: 28 }}>Hey, {firstName}</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 28 }}>
        Your people leave the best stories on your Wall.
      </Text>

      <Pressable onPress={() => router.push("/wall")}>
        <View style={[{ backgroundColor: markColors.brandYellow, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, padding: 20 }, shadow.cta]}>
          <Text variant="label">MY WALL</Text>
          <Text variant="display" style={{ fontSize: 25, marginTop: 4 }}>See what they left →</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => router.push("/(tabs)/discover")} style={{ minHeight: 64, justifyContent: "center", marginTop: 18 }}>
        <Text variant="headline">Find your people</Text>
        <Text variant="body" color={colors.outline}>Search handles, answer requests, visit friends' Walls.</Text>
      </Pressable>
    </Screen>
  );
}
