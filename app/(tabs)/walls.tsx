import { useCallback, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { InviteCrew } from "@/components/InviteCrew";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { getOwnedSharedWalls } from "@/lib/walls";
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
  const [sharedWalls, setSharedWalls] = useState<Wall[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!session?.user) return;
        const [w, owned] = await Promise.all([
          getPersonalWall(session.user.id),
          getOwnedSharedWalls(session.user.id),
        ]);
        if (!active) return;
        setWall(w);
        setSharedWalls(owned);
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

      {/* OUR STORY — real, public Shared Walls (private/members are C2). */}
      <View style={{ marginTop: 30 }}>
        <Text variant="label" color={colors.outline}>
          OUR STORY · SHARED WALLS
        </Text>

        {sharedWalls.map((sw) => (
          <Pressable key={sw.id} onPress={() => router.push(`/shared/${sw.id}`)} style={{ marginTop: 12 }}>
            <View
              style={{
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: radius.card,
                padding: 16,
                backgroundColor: colors.card,
              }}
            >
              <Text variant="headline">{sw.name}</Text>
              <Text variant="label" color={colors.outline} style={{ marginTop: 6 }}>
                PUBLIC · SHARED
              </Text>
            </View>
          </Pressable>
        ))}

        {sharedWalls.length === 0 ? (
          <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 12, marginBottom: 4 }}>
            Start a wall your whole crew can write on — a trip, a class, a group of friends.
          </Text>
        ) : null}

        <View style={{ marginTop: 14 }}>
          <Button label="Start a Shared Wall" variant="yellow" onPress={() => router.push("/shared/create")} />
        </View>

        <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginTop: 12 }}>
          Public Shared Walls only for now — private, members-only walls are coming soon.
        </Text>
      </View>
    </Screen>
  );
}
