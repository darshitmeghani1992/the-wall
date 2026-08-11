import { useState } from "react";
import { View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

/**
 * Passwordless email + social sign-in. Step 1 collects an email and sends a
 * 6-digit code; step 2 verifies it. On success the auth gate (index) takes over
 * and routes to profile setup or Home.
 */
export default function SignIn() {
  const router = useRouter();
  const { signInWithEmail, verifyEmailOtp, signInWithOAuth } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!email.includes("@")) return Alert.alert("Enter a valid email");
    setBusy(true);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
    } catch (e: any) {
      Alert.alert("Couldn't send the code", e?.message ?? "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      router.replace("/"); // re-run the auth gate
    } catch (e: any) {
      Alert.alert("That code didn't work", e?.message ?? "Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    setBusy(true);
    try {
      await signInWithOAuth(provider);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign-in failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8, marginBottom: 24 }}>
        <Text variant="label" color={colors.outline}>
          {sent ? "CHECK YOUR EMAIL" : "SIGN IN"}
        </Text>
        <Text variant="display" style={{ fontSize: 30 }}>
          {sent ? "Enter your code" : "Let's get you in"}
        </Text>
        {sent ? (
          <Text variant="body" color={colors.onSurfaceVariant}>
            We sent a 6-digit code to {email}.
          </Text>
        ) : null}
      </View>

      {!sent ? (
        <View style={{ gap: 16 }}>
          <Input
            label="Email"
            placeholder="you@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Button label="Email me a code" variant="primary" loading={busy} onPress={sendCode} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.outlineVariant }} />
            <Text variant="label" color={colors.outline}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.outlineVariant }} />
          </View>

          <Button label="Continue with Apple" variant="ghost" onPress={() => oauth("apple")} />
          <Button label="Continue with Google" variant="ghost" onPress={() => oauth("google")} />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Input
            label="6-digit code"
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <Button label="Verify & continue" variant="yellow" loading={busy} onPress={verify} />
          <Button label="Use a different email" variant="ghost" onPress={() => setSent(false)} />
        </View>
      )}
    </Screen>
  );
}
