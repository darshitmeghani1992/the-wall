import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { decideAuthCallback } from "@/lib/auth-callback-contract";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, markColors } from "@/theme";

/**
 * Deep-link landing for auth redirects (magic link / OAuth). Exchanges the
 * `code` for a session, then hands off to the auth gate at `/`.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { code, error: providerError, error_code: providerErrorCode, error_description: providerErrorDescription } =
    useLocalSearchParams<{
      code?: string | string[];
      error?: string | string[];
      error_code?: string | string[];
      error_description?: string | string[];
    }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // An old redirect cannot navigate after the callback route is replaced.
    let active = true;
    setError(null);
    const completeSignIn = async () => {
      try {
        const decision = decideAuthCallback({
          code,
          error: providerError,
          error_code: providerErrorCode,
          error_description: providerErrorDescription,
        });
        // Even if another account has a session, an explicit refusal or malformed
        // (including duplicate) code is never a successful sign-in.
        if (decision.kind === "reject") {
          throw new Error("Sign-in was cancelled or invalid. Please try again.");
        }
        if (decision.kind === "exchange") {
          // Supabase can report an AuthError in the response without throwing.
          const { data: exchanged, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(decision.code);
          if (exchangeError) throw exchangeError;
          if (!exchanged?.session) throw new Error("Sign-in did not create a session. Please try again.");
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
  }, [code, providerError, providerErrorCode, providerErrorDescription, router]);

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
