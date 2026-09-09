import { Alert, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { reactivateAccount } from "@/lib/account";
import { colors, markColors, radius } from "@/theme";

export default function AccountStatusScreen() {
  const router = useRouter();
  const { profile, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const suspended = profile?.account_status === "suspended";

  async function reactivate() {
    setBusy(true);
    try {
      await reactivateAccount();
      await refreshProfile();
      router.replace("/home");
    } catch (cause: any) {
      Alert.alert("Couldn't reactivate", cause?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 42 }}>
        <Text variant="display">the wall</Text>
        <View style={{ marginTop: 28, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, padding: 18, backgroundColor: markColors.brandYellow }}>
          <Text variant="headline">{suspended ? "Account unavailable" : "Your account is deactivated"}</Text>
          <Text variant="body" style={{ marginTop: 8 }}>
            {suspended
              ? "This account has been suspended and can't be reactivated from the app."
              : "Your profile and Walls are currently hidden from normal interaction. Reactivate to return to The Wall."}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 26, gap: 12 }}>
        {!suspended ? <Button label="Reactivate account" variant="yellow" loading={busy} onPress={reactivate} /> : null}
        <Button label="Sign out" variant="primary" onPress={signOut} />
      </View>
    </Screen>
  );
}
