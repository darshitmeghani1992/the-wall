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
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (code) await supabase.auth.exchangeCodeForSession(String(code));
      } catch (e: any) {
        setError(e?.message ?? "Sign-in link expired. Please try again.");
        return;
      }
      router.replace("/");
    })();
  }, [code]);

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
