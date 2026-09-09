import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth";
import { setPendingLink } from "@/lib/pendingLink";
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
  const { loading, session, needsProfile, profile } = useAuth();

  useEffect(() => {
    if (loading || !wallId) return;
    if (!session || needsProfile || profile?.account_status !== "active") {
      setPendingLink(`/s/${wallId}`);
    }
  }, [loading, session, needsProfile, profile?.account_status, wallId]);

  if (loading) return <Spinner />;
  if (!session) return <Redirect href="/welcome" />;
  if (needsProfile) return <Redirect href="/profile-setup" />;
  if (profile?.account_status !== "active") return <Redirect href="/account-status" />;
  if (!wallId) return <Redirect href="/(tabs)/walls" />;
  return <Redirect href={`/shared/${wallId}`} />;
}
