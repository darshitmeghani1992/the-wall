import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { createSharedWall } from "@/lib/walls";
import { colors, markColors, radius } from "@/theme";

export default function CreateSharedWallScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const wall = await createSharedWall({ name, visibility });
      if (router.canDismiss()) router.dismissAll();
      router.push(`/shared/${wall.id}`);
    } catch (cause: any) {
      Alert.alert("Couldn't create that", cause?.message ?? "Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Screen dockInset={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 18 }}>
        <Text variant="display" style={{ fontSize: 24 }}>Start a Shared Wall</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="label" color={colors.outline}>CLOSE</Text>
        </Pressable>
      </View>

      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: 18 }}>
        A Wall your whole crew can build together — a trip, class, event, team or group of friends.
      </Text>

      <Input label="NAME" value={name} onChangeText={setName} placeholder="Goa Trip '26" autoFocus maxLength={60} />

      <Text variant="label" color={colors.outline} style={{ marginTop: 22, marginBottom: 10 }}>WHO CAN SEE IT</Text>
      <View style={{ gap: 10 }}>
        {(["public", "private"] as const).map((option) => {
          const selected = visibility === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setVisibility(option)}
              style={{
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: radius.card,
                padding: 14,
                backgroundColor: selected ? colors.ink : colors.card,
              }}
            >
              <Text variant="headline" color={selected ? colors.surface : colors.ink}>
                {option === "public" ? "Public" : "Private"}
              </Text>
              <Text
                variant="body"
                color={selected ? markColors.brandYellow : colors.onSurfaceVariant}
                style={{ fontSize: 13, marginTop: 3 }}
              >
                {option === "public"
                  ? "Anyone with access to the link can view and add Marks."
                  : "Only people you invite and who accept can view and add Marks."}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visibility === "private" ? (
        <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginTop: 12 }}>
          After creating it, invite members by handle from the Shared Wall.
        </Text>
      ) : null}

      <View style={{ marginTop: 26 }}>
        <Button label="Create Shared Wall" variant="yellow" loading={submitting} disabled={!canSubmit} onPress={submit} />
      </View>
    </Screen>
  );
}
