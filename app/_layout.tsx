import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { colors } from "@/theme";

/**
 * Root navigator. The (tabs) group holds the persistent bottom-dock experience;
 * (onboarding) is the signed-out / first-run flow; everything else (Create,
 * Writer, Game, Notifications, Settings, Friend Wall) is pushed on top.
 *
 * Everything is wrapped in <AuthProvider> so any screen can read auth/profile
 * state and `app/index.tsx` can route the user to the right place.
 *
 * Fonts: Bricolage Grotesque / Geist / Space Mono .ttf files go in
 * `assets/fonts/` and get wired through `expo-font`'s `useFonts` here before the
 * first paint. Until the binaries are added the app falls back to system fonts.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="create" options={{ presentation: "modal" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
