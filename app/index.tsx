import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { consumePendingLink } from "@/lib/pendingLink";
import { Text } from "@/components/Text";
import { colors, markColors } from "@/theme";

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <Text variant="display" color={colors.ink}>the wall</Text>
      <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 16 }} />
    </View>
  );
}

export default function Index() {
  const { loading, session, needsProfile, profile } = useAuth();
  const [target, setTarget] = useState<string | null>(null);
  const consumed = useRef(false);
  const accountInactive = Boolean(profile && profile.account_status !== "active");

  useEffect(() => {
    if (loading || !session || needsProfile || accountInactive) return;
    if (consumed.current) return;
    consumed.current = true;
    setTarget(consumePendingLink() ?? "/home");
  }, [loading, session, needsProfile, accountInactive]);

  if (loading) return <Splash />;
  if (!session) return <Redirect href="/welcome" />;
  if (needsProfile) return <Redirect href="/profile-setup" />;
  if (accountInactive) return <Redirect href="/account-status" />;
  if (target === null) return <Splash />;
  return <Redirect href={target} />;
}
