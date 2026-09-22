import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth";
import { destinationForAccountRoute } from "@/lib/onboarding-contract";
import { colors, markColors } from "@/theme";

function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={markColors.brandYellow} />
    </View>
  );
}

/** Auth-safe entry for `thewall://s/<wall-id>` Shared-Wall links. */
export default function SharedWallLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallId = String(id ?? "");
  const { loading, session, accountRoute } = useAuth();

  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/welcome" />;
  if (!accountRoute) return <Spinner />;
  if (accountRoute !== "ready") return <Redirect href={destinationForAccountRoute(accountRoute)} />;
  if (!wallId) return <Redirect href="/(tabs)/home" />;
  return <Redirect href={`/shared/${wallId}`} />;
}
