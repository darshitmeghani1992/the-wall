import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { colors } from "@/theme";

/**
 * Root navigator. The (tabs) group holds the persistent bottom-dock experience;
 * (onboarding) is the signed-out / first-run flow; everything else is pushed on
 * top as focused product journeys.
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
          <Stack.Screen name="people-picker" options={{ presentation: "modal" }} />
          <Stack.Screen name="profile-edit" options={{ presentation: "modal" }} />
          <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
          <Stack.Screen name="social/[kind]" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="shared/create" options={{ presentation: "modal" }} />
          <Stack.Screen name="shared/[id]" />
          <Stack.Screen name="u/[handle]" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
