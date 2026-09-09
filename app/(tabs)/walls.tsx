import { useCallback, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { InviteCrew } from "@/components/InviteCrew";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { getJoinedSharedWalls, getOwnedSharedWalls } from "@/lib/walls";
import { supabase } from "@/lib/supabase";
import type { Wall } from "@/lib/types";
import { colors, markColors, radius, shadow } from "@/theme";

export default function WallsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const [wall, setWall] = useState<Wall | null>(null);
  const [markCount, setMarkCount] = useState(0);
  const [ownedSharedWalls, setOwnedSharedWalls] = useState<Wall[]>([]);
  const [joinedSharedWalls, setJoinedSharedWalls] = useState<Wall[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!userId) return;
        setLoading(true);
        const [w, owned, joined] = await Promise.all([
          getPersonalWall(userId),
          getOwnedSharedWalls(userId),
          getJoinedSharedWalls(userId),
        ]);
        if (!active) return;
        setWall(w);
        setOwnedSharedWalls(owned);
        setJoinedSharedWalls(joined.filter((item) => item.owner_id !== userId));
        if (w) {
          const { count } = await supabase
            .from("marks")
            .select("id", { count: "exact", head: true })
            .eq("wall_id", w.id)
            .eq("status", "active");
          if (active) setMarkCount(count ?? 0);
        }
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [userId]),
  );

  function SharedWallCard({ sharedWall, owned }: { sharedWall: Wall; owned: boolean }) {
    return (
      <Pressable onPress={() => router.push(`/shared/${sharedWall.id}`)} style={{ marginTop: 12 }}>
        <View style={{ borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, padding: 16, backgroundColor: colors.card }}>
          <Text variant="headline">{sharedWall.name}</Text>
          <Text variant="label" color={colors.outline} style={{ marginTop: 6 }}>
            {sharedWall.visibility.toUpperCase()} · {owned ? "YOU STARTED THIS" : "MEMBER"}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen>
      <Text variant="display" style={{ marginVertical: 20 }}>Your Walls</Text>

      <Text variant="label" color={colors.outline}>MY STORY</Text>
      <View style={{ height: 10 }} />

      {loading ? <ActivityIndicator color={markColors.brandYellow} /> : (
        <>
          <Pressable onPress={() => router.push("/wall")}>
            <View style={[{ backgroundColor: markColors.brandYellow, borderRadius: radius.card, borderWidth: 2, borderColor: colors.ink, padding: 18 }, shadow.cta]}>
              <Text variant="display" style={{ fontSize: 24 }}>{wall?.name ?? `${profile?.display_name ?? "My"}'s Wall`}</Text>
              <Text variant="label" color={colors.ink} style={{ marginTop: 6 }}>
                {markCount} MARKS · {profile?.handle ? `@${profile.handle}` : "PERSONAL"}
              </Text>
            </View>
          </Pressable>
          {markCount === 0 ? <View style={{ marginTop: 18 }}><InviteCrew handle={profile?.handle} /></View> : null}
        </>
      )}

      <View style={{ marginTop: 30 }}>
        <Text variant="label" color={colors.outline}>OUR STORY · SHARED WALLS</Text>

        {ownedSharedWalls.length ? (
          <View style={{ marginTop: 12 }}>
            <Text variant="label" color={colors.onSurfaceVariant}>STARTED BY YOU</Text>
            {ownedSharedWalls.map((sw) => <SharedWallCard key={sw.id} sharedWall={sw} owned />)}
          </View>
        ) : null}

        {joinedSharedWalls.length ? (
          <View style={{ marginTop: 20 }}>
            <Text variant="label" color={colors.onSurfaceVariant}>YOU'RE A MEMBER</Text>
            {joinedSharedWalls.map((sw) => <SharedWallCard key={sw.id} sharedWall={sw} owned={false} />)}
          </View>
        ) : null}

        {!ownedSharedWalls.length && !joinedSharedWalls.length ? (
          <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 12, marginBottom: 4 }}>
            Start a wall for a trip, class, team or group — or accept an invite from Alerts.
          </Text>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <Button label="Start a Shared Wall" variant="yellow" onPress={() => router.push("/shared/create")} />
        </View>
      </View>
    </Screen>
  );
}
