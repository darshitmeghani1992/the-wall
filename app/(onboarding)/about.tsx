import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, markColors } from "@/theme";

const POINTS = [
  {
    k: "Your wall is receive-first",
    d: "The best part of your Wall is what other people leave for you — memories, notes and moments worth keeping.",
  },
  {
    k: "Leave Marks on people you care about",
    d: "Write a note, share a photo, record a voice message or leave a short video on someone else's Wall.",
  },
  {
    k: "Some moments can be private",
    d: "Use Anonymous when the Wall allows it, or Secret for a private text Mark meant only for its recipient.",
  },
];

/** Conceptual onboarding: explain the current MVP interaction model honestly. */
export default function About() {
  const router = useRouter();
  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8 }}>
        <Text variant="label" color={colors.outline}>
          HOW THE WALL WORKS
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
                borderRadius: 17,
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

      <Button label="Set up my Wall" variant="primary" onPress={() => router.push("/profile-setup")} />
    </Screen>
  );
}
