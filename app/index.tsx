import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Text } from "@/components/Text";
import { colors, markColors } from "@/theme";

/**
 * App entry / auth gate. Branches on auth + profile state:
 *   - loading            → splash spinner
 *   - signed out         → onboarding welcome
 *   - signed in, no row  → profile setup
 *   - fully set up        → Home
 */
export default function Index() {
  const { loading, session, needsProfile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <Text variant="display" color={colors.ink}>
          the wall
        </Text>
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!session) return <Redirect href="/welcome" />;
  if (needsProfile) return <Redirect href="/profile-setup" />;
  return <Redirect href="/home" />;
}
