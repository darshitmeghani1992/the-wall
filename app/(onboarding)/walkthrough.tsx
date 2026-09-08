import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, markColors, radius } from "@/theme";

const STEPS = [
  {
    title: "Invite the people who matter",
    body: "Your Wall gets better when friends and family are there. Start by finding people or sharing your Wall.",
  },
  {
    title: "Leave a Mark on someone else's Wall",
    body: "Tap the + button, choose a person, then leave a text, photo, voice or video Mark for them.",
  },
  {
    title: "Come back to what people leave for you",
    body: "Your Wall is receive-first. New Marks appear there so the moments worth keeping do not disappear in a feed.",
  },
];

/** One-time post-profile orientation. It is only routed to immediately after profile creation. */
export default function Walkthrough() {
  const router = useRouter();

  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8 }}>
        <Text variant="label" color={colors.outline}>
          YOUR WALL IS READY
        </Text>
        <Text variant="display" style={{ fontSize: 32 }}>
          Three things to know.
        </Text>
      </View>

      <View style={{ gap: 14, marginTop: 26, marginBottom: 28 }}>
        {STEPS.map((step, index) => (
          <View
            key={step.title}
            style={{
              borderWidth: 2,
              borderColor: colors.ink,
              borderRadius: radius.card,
              backgroundColor: colors.card,
              padding: 16,
              flexDirection: "row",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 2,
                borderColor: colors.ink,
                backgroundColor: markColors.brandYellow,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="headline">{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{step.title}</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 4 }}>
                {step.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Button label="Open my Wall" variant="yellow" onPress={() => router.replace("/home")} />
    </Screen>
  );
}
