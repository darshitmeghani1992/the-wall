import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { createSharedWall } from "@/lib/walls";
import { colors, markColors, radius } from "@/theme";

/**
 * Create a public Shared Wall (name + public). Private/members are honestly gated
 * as "coming soon" because enforcing membership needs a `wall_members` table +
 * RLS that don't exist yet (C2). We never let the user pick a setting we can't
 * actually enforce.
 */
export default function CreateSharedWallScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const wall = await createSharedWall({ name });
      if (router.canDismiss()) router.dismissAll();
      router.push(`/shared/${wall.id}`);
    } catch (cause: any) {
      Alert.alert("Couldn't create that", cause?.message ?? "Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Screen dockInset={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          marginBottom: 18,
        }}
      >
        <Text variant="display" style={{ fontSize: 24 }}>
          Start a Shared Wall
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="label" color={colors.outline}>
            CLOSE
          </Text>
        </Pressable>
      </View>

      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: 18 }}>
        A wall your whole crew can write on — a trip, a class, a group of friends.
      </Text>

      <Input label="NAME" value={name} onChangeText={setName} placeholder="Goa Trip '26" autoFocus maxLength={60} />

      <Text variant="label" color={colors.outline} style={{ marginTop: 22, marginBottom: 10 }}>
        WHO CAN SEE IT
      </Text>
      <View style={{ gap: 10 }}>
        <View
          style={{
            borderWidth: 2,
            borderColor: colors.ink,
            borderRadius: radius.card,
            padding: 14,
            backgroundColor: colors.ink,
          }}
        >
          <Text variant="headline" color={colors.surface}>
            Public
          </Text>
          <Text variant="label" color={markColors.brandYellow} style={{ marginTop: 3 }}>
            Anyone with the link can view & add
          </Text>
        </View>

        {/* Private is intentionally NOT selectable — enforcing membership needs the
            C2 wall_members model. Showing it disabled is more honest than shipping
            a private wall we can't actually gate. */}
        <View
          style={{
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.outlineVariant,
            borderRadius: radius.card,
            padding: 14,
            opacity: 0.75,
          }}
          accessible
          accessibilityLabel="Private shared walls, coming soon, not yet available"
        >
          <Text variant="headline" color={colors.outline}>
            Private · coming soon
          </Text>
          <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginTop: 2 }}>
            Members-only walls need invite controls we haven&apos;t shipped yet.
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 26 }}>
        <Button
          label="Create Shared Wall"
          variant="yellow"
          loading={submitting}
          disabled={!canSubmit}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}
