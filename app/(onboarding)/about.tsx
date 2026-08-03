import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, markColors } from "@/theme";

const POINTS = [
  { k: "A wall, not a feed", d: "Your wall is a living scrapbook — meaningful memories, not a chat that scrolls away." },
  { k: "Friends leave Marks", d: "Stickies, roasts, secrets, photos, awards, polls — little notes pinned to your wall." },
  { k: "Worth revisiting", d: "Every Mark is something you'll want to look back on months or years later." },
];

/** Conceptual onboarding: "What is a Wall?" */
export default function About() {
  const router = useRouter();
  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8 }}>
        <Text variant="label" color={colors.outline}>
          // WHAT IS A WALL?
        </Text>
        <Text variant="display" style={{ fontSize: 32 }}>
          People help write your story.
        </Text>
      </View>

      <View style={{ gap: 18, marginTop: 28, marginBottom: 28 }}>
        {POINTS.map((p, i) => (
          <View key={p.k} style={{ flexDirection: "row", gap: 14 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                backgroundColor: markColors.brandYellow,
                borderWidth: 2,
                borderColor: colors.ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="headline">{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{p.k}</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 2 }}>
                {p.d}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Button label="Next" variant="primary" onPress={() => router.push("/interests")} />
    </Screen>
  );
}
