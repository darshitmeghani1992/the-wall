import { useEffect, useState } from "react";
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
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function sendCode() {
    if (!email.includes("@")) return Alert.alert("Enter a valid email");
    setBusy(true);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
      setResendCooldown(30);
    } catch (cause) {
      Alert.alert("Couldn't send the code", authErrorMessage(cause, "send"));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert("Enter the 6-digit code", "Use the complete code from your email.");
      return;
    }
    setBusy(true);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      router.replace("/"); // re-run the auth gate
    } catch (cause) {
      Alert.alert("That code didn't work", authErrorMessage(cause, "verify"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || resendCooldown > 0) return;
    await sendCode();
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
          // {sent ? "CHECK YOUR EMAIL" : "SIGN IN"}
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
          <Button
            label={resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            variant="ghost"
            disabled={busy || resendCooldown > 0}
            onPress={() => void resend()}
          />
          <Button label="Use a different email" variant="ghost" disabled={busy} onPress={() => {
            setSent(false);
            setCode("");
            setResendCooldown(0);
          }} />
        </View>
      )}
    </Screen>
  );
}

function authErrorMessage(cause: unknown, phase: "send" | "verify"): string {
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (message.includes("rate") || message.includes("too many")) {
    return "Too many attempts. Wait a moment before trying again.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Check your connection and try again.";
  }
  if (phase === "verify" && message.includes("expired")) {
    return "That code has expired. Request a new code.";
  }
  return phase === "verify"
    ? "The code is incorrect or expired. Check it, or request a new one."
    : "We couldn't reach the sign-in service. Try again in a moment.";
}
