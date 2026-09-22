import { View } from "react-native";
import { Redirect } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

export default function AccountUnavailable() {
  const { accountRoute, signOut } = useAuth();
  if (accountRoute && accountRoute !== "suspended" && accountRoute !== "unavailable") {
    return <Redirect href="/" />;
  }
  const suspended = accountRoute === "suspended";
  return (
    <Screen scroll={false} dockInset={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Text variant="label" color={colors.outline}>ACCOUNT UNAVAILABLE</Text>
        <Text variant="display" style={{ fontSize: 32 }}>{suspended ? "This account is suspended." : "We can't open this account."}</Text>
        <Text variant="body" color={colors.onSurfaceVariant}>
          {suspended ? "You can't use The-Wall with this account right now." : "Sign out, then try signing in again."}
        </Text>
      </View>
      <View style={{ paddingBottom: 12 }}><Button label="Sign out" variant="primary" onPress={() => void signOut()} /></View>
    </Screen>
  );
}
