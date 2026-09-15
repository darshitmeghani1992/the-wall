import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { colors } from "@/theme";

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
          <Stack.Screen name="status" options={{ presentation: "modal" }} />
          <Stack.Screen name="help" options={{ presentation: "modal" }} />
          <Stack.Screen name="account-recovery" />
          <Stack.Screen name="account-unavailable" />
          <Stack.Screen name="settings" options={{ presentation: "modal" }} />
          <Stack.Screen name="personal-wall-settings" />
          <Stack.Screen name="approved-writers" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="notifications" options={{ presentation: "modal" }} />
          <Stack.Screen name="social/[kind]" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="report-user/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="shared/create" options={{ presentation: "modal" }} />
          <Stack.Screen name="shared/[id]" />
          <Stack.Screen name="u/[handle]" />
          <Stack.Screen name="s/[id]" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
