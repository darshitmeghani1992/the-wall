import { Stack } from "expo-router";
import { colors } from "@/theme";

/** The signed-out / first-run flow, pushed as a plain stack. */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: "slide_from_right",
      }}
    />
  );
}
