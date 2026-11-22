import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Text } from "@/components/Text";
import { colors, markColors } from "@/theme";

/**
 * Deep-link landing for auth redirects (magic link / OAuth). Exchanges the
 * `code` for a session, then hands off to the auth gate at `/`.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // An old redirect cannot navigate after the callback route is replaced.
    let active = true;
    const completeSignIn = async () => {
      try {
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
  }, [code, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 14 }}>
      {error ? (
        <Text variant="body" color={colors.error}>
          {error}
        </Text>
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
