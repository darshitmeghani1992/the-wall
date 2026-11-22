import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, markColors } from "@/theme";

/**
 * Deep-link landing for auth redirects (magic link / OAuth). Exchanges the
 * `code` for a session, then hands off to the auth gate at `/`.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { code, error: providerError } = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // An old redirect cannot navigate after the callback route is replaced.
    let active = true;
    setError(null);
    const completeSignIn = async () => {
      try {
        // An explicit OAuth refusal is never a successful callback, even if
        // another account already has a valid session on this device.
        if (providerError) throw new Error("Sign-in was cancelled or denied. Please try again.");
        if (typeof code === "string" && code.length > 0) {
          // Supabase AuthErrors often arrive in the result rather than throwing.
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          // A valid existing session can arrive here without an OAuth code.
          // Never treat a missing/invalid code as a successful login.
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) throw new Error("Sign-in link missing or expired. Please try again.");
        }
        if (active) router.replace("/");
      } catch (e: unknown) {
        if (active) {
          setError(e instanceof Error ? e.message : "Sign-in link expired. Please try again.");
        }
      }
    };
    void completeSignIn();
    return () => {
      active = false;
    };
  }, [code, providerError, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 14 }}>
      {error ? (
        <View style={{ alignItems: "center", gap: 16, paddingHorizontal: 24 }} accessibilityRole="alert">
          <Text variant="body" color={colors.error}>
            {error}
          </Text>
          <Button
            label="Try signing in again"
            variant="primary"
            onPress={() => router.replace("/(onboarding)/sign-in")}
          />
        </View>
      ) : (
        <>
          <Text variant="display" style={{ fontSize: 24 }}>
            Signing you in…
          </Text>
          <ActivityIndicator color={markColors.brandYellow} />
        </>
      )}
    </View>
  );
}
