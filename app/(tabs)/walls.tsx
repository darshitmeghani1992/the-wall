import { useCallback, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { InviteCrew } from "@/components/InviteCrew";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import type { Wall } from "@/lib/types";
import { colors, markColors, radius, shadow } from "@/theme";

/**
 * Walls hub — "MY STORY" (the Personal Wall) plus an "OUR STORY · V3" teaser.
 * Loads the user's wall + its mark count; a brand-new wall shows InviteCrew.
 */
export default function WallsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [wall, setWall] = useState<Wall | null>(null);
  const [markCount, setMarkCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!session?.user) return;
        const w = await getPersonalWall(session.user.id);
        if (!active) return;
        setWall(w);
        if (w) {
          const { count } = await supabase
            .from("marks")
            .select("id", { count: "exact", head: true })
            .eq("wall_id", w.id)
            .eq("status", "active");
          if (active) setMarkCount(count ?? 0);
        }
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [session?.user?.id]),
  );

  return (
    <Screen>
      <Text variant="display" style={{ marginVertical: 20 }}>
        Your Walls
      </Text>

      <Text variant="label" color={colors.outline}>
        MY STORY
      </Text>
      <View style={{ height: 10 }} />

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} />
      ) : (
        <>
          {/* Personal wall card → My Wall (Phase 2 hero screen) */}
          <Pressable onPress={() => router.push("/wall")}>
            <View
              style={[
                {
                  backgroundColor: markColors.brandYellow,
                  borderRadius: radius.card,
                  borderWidth: 2,
                  borderColor: colors.ink,
                  padding: 18,
                },
                shadow.cta,
              ]}
            >
              <Text variant="display" style={{ fontSize: 24 }}>
                {wall?.name ?? `${profile?.display_name ?? "My"}'s Wall`}
              </Text>
              <Text variant="label" color={colors.ink} style={{ marginTop: 6 }}>
                {markCount} MARKS · {profile?.handle ? `@${profile.handle}` : "PERSONAL"}
              </Text>
            </View>
          </Pressable>

          {markCount === 0 ? (
            <View style={{ marginTop: 18 }}>
              <InviteCrew handle={profile?.handle} />
            </View>
          ) : null}
        </>
      )}

      {/* OUR STORY teaser (Shared Walls are a later version) */}
      <View style={{ marginTop: 30 }}>
        <Text variant="label" color={colors.outline}>
          OUR STORY · V3
        </Text>
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.outlineVariant,
            borderRadius: radius.card,
            padding: 16,
          }}
        >
          <Text variant="body" color={colors.onSurfaceVariant}>
            Shared Walls for trips, families and crews are coming soon.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {["Goa Trip", "Class of '26", "Family"].map((t) => (
              <View
                key={t}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceContainer,
                }}
              >
                <Text variant="body" color={colors.outline} style={{ fontSize: 13 }}>
                  {t}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}
