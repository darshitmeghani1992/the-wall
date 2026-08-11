import { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { INTEREST_TAGS, onboardingDraft } from "@/lib/onboarding";
import { colors, markColors, radius, tiltFor } from "@/theme";

/** Tag a few interests for discovery. Selection is stashed in the draft and
 *  saved onto the profile at setup. */
export default function Interests() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(onboardingDraft.interests);

  function toggle(tag: string) {
    setSelected((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );
  }

  function next() {
    onboardingDraft.interests = selected;
    router.push("/sign-in");
  }

  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8, marginBottom: 20 }}>
        <Text variant="label" color={colors.outline}>
          PICK A FEW
        </Text>
        <Text variant="display" style={{ fontSize: 30 }}>
          What are you into?
        </Text>
        <Text variant="body" color={colors.onSurfaceVariant}>
          Helps us surface walls and people you'll vibe with.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {INTEREST_TAGS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: colors.ink,
                backgroundColor: on ? markColors.brandYellow : colors.surface,
                transform: [{ rotate: `${tiltFor(tag)}deg` }],
              }}
            >
              <Text variant="body" color={colors.ink} style={{ fontWeight: on ? "700" : "500" }}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 28 }}>
        <Button
          label={selected.length ? `Continue · ${selected.length}` : "Skip for now"}
          variant="primary"
          onPress={next}
        />
      </View>
    </Screen>
  );
}
