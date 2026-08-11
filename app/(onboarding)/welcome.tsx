import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MarkCard } from "@/components/MarkCard";
import { colors, markColors } from "@/theme";

/** Splash / value prop — the first thing a signed-out visitor sees. */
export default function Welcome() {
  const router = useRouter();
  return (
    <Screen scroll={false} dockInset={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 22 }}>
        <Text variant="label" color={colors.outline}>
          WELCOME TO
        </Text>
        <Text variant="display" style={{ fontSize: 44, lineHeight: 46 }}>
          the wall
        </Text>
        <Text variant="mark" color={colors.onSurfaceVariant} style={{ fontSize: 19 }}>
          Your story, written by the people around you. Friends leave Marks — you keep the memories.
        </Text>

        <View style={{ height: 8 }} />
        {/* The example Mark is the star — it DROPs on entry, demonstrating the
            signature moment wordlessly in the first seconds (VD-7 / surface 1). */}
        <MarkCard id="welcome-sticky" background={markColors.stickyYellow} fastener="tape" dropIn>
          <Text variant="mark">you're the reason we always run late 😭</Text>
          <Text variant="label" color={colors.outline} style={{ marginTop: 10 }}>
            — SOFIA
          </Text>
        </MarkCard>
      </View>

      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Button label="Get started" variant="yellow" onPress={() => router.push("/about")} />
        <Button label="I already have an account" variant="ghost" onPress={() => router.push("/sign-in")} />
      </View>
    </Screen>
  );
}
