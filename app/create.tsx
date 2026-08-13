import { View, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const { wallId, recipientId, handle, sharedWallId, wallName } = useLocalSearchParams<{
    wallId?: string;
    recipientId?: string;
    handle?: string;
    sharedWallId?: string;
    wallName?: string;
  }>();

  // Two ways in: a person's Wall (needs a real recipient) or a Shared Wall.
  const shared = Boolean(sharedWallId);

  if (!shared && (!wallId || !recipientId || !handle)) {
    return (
      <Screen dockInset={false}>
        <View style={{ marginTop: 40, gap: 12 }}>
          <Text variant="headline">Choose whose Wall this is for</Text>
          <Text variant="body" color={colors.onSurfaceVariant}>A Mark can't be created without a real recipient.</Text>
          <Pressable onPress={() => router.replace("/people-picker")} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text variant="label">CHOOSE A PERSON →</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Query string appended to /write/[type] — either a shared-wall target or a
  // person target.
  const writeQuery = shared
    ? `sharedWallId=${sharedWallId}&wallName=${encodeURIComponent(wallName ?? "")}`
    : `wallId=${wallId}&recipientId=${recipientId}&handle=${encodeURIComponent(handle ?? "")}`;

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
        <View>
          <Text variant="display">Leave a Mark</Text>
          <Text variant="label" color={colors.outline}>
            {shared ? `ON ${wallName ?? "A SHARED WALL"}` : `FOR @${handle}`}
          </Text>
        </View>
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
              onPress={() => router.push(`/write/${t.key}?${writeQuery}`)}
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
