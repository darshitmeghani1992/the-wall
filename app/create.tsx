import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MarkCard } from "@/components/MarkCard";
import { colors, markColors, radius } from "@/theme";

/**
 * Leave a Mark — the type picker (Create modal). Active tiles open the Writer;
 * the rest are "coming soon" until their own slice lands.
 */
const TYPES = [
  { key: "sticky", label: "Sticky", sub: "A quick note", bg: markColors.stickyYellow },
  { key: "roast", label: "Roast", sub: "Lovingly savage", bg: markColors.roastOrange },
  { key: "secret", label: "Secret", sub: "Blurred til tapped", bg: markColors.secretPurple },
  { key: "memory", label: "Memory", sub: "A photo + caption", bg: markColors.memoryCream },
] as const;

export default function CreateScreen() {
  const router = useRouter();
  return (
    <Screen scroll dockInset={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginVertical: 16,
        }}
      >
        <Text variant="display">Leave a Mark</Text>
        <Pressable onPress={() => router.back()}>
          <Text variant="label" color={colors.outline}>
            CLOSE
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {TYPES.map((t) => (
          <View key={t.key} style={{ width: "47%" }}>
            <MarkCard
              id={`type-${t.key}`}
              background={t.bg}
              bordered={t.key === "roast"}
              fastener="none"
              onPress={() => router.push(`/write/${t.key}`)}
            >
              <Text
                variant="headline"
                color={t.key === "secret" ? markColors.secretOnPurple : colors.ink}
              >
                {t.label}
              </Text>
              <Text
                variant="body"
                color={t.key === "secret" ? markColors.secretOnPurple : colors.onSurfaceVariant}
                style={{ marginTop: 4 }}
              >
                {t.sub}
              </Text>
            </MarkCard>
          </View>
        ))}
      </View>

      <Text variant="label" color={colors.outline} style={{ marginTop: 8 }}>
        COMING SOON
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        {["Poll", "Award", "Predict", "Doodle"].map((label) => (
          <View
            key={label}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              borderStyle: "dashed",
            }}
          >
            <Text variant="body" color={colors.outline}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
