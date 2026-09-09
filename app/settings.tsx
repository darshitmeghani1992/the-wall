import { Alert, Pressable, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { deactivateAccount } from "@/lib/account";
import { colors } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  function confirmDeactivate() {
    Alert.alert(
      "Deactivate your account?",
      "Your profile and Walls will stop being discoverable or interactable. You can sign back in and reactivate during the recovery window.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deactivateAccount();
              await refreshProfile();
              router.replace("/account-status");
            } catch (cause: any) {
              Alert.alert("Couldn't deactivate", cause?.message ?? "Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen dockInset={false}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: 8 }}>Settings</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 26 }}>
        Manage your profile session and account lifecycle.
      </Text>

      <View style={{ gap: 12 }}>
        <Button label="Edit profile" variant="ghost" onPress={() => router.push("/profile-edit")} />
        <Button label="Sign out" variant="primary" onPress={signOut} />
      </View>

      <View style={{ marginTop: 34, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 20 }}>
        <Text variant="label" color={colors.error}>ACCOUNT</Text>
        <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8, marginBottom: 12 }}>
          Deactivation is recoverable. Your existing content is preserved while your account is inactive.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy || profile?.account_status !== "active"}
          onPress={confirmDeactivate}
          style={{ minHeight: 48, justifyContent: "center", opacity: busy ? 0.5 : 1 }}
        >
          <Text variant="label" color={colors.error}>DEACTIVATE ACCOUNT</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
