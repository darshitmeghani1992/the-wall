import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Masonry } from "@/components/Masonry";
import { InviteCrew } from "@/components/InviteCrew";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { shareMyWall, inviteFriends } from "@/lib/share";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { getWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { supabase } from "@/lib/supabase";
import type { MarkType, Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

type Filter = { key: string; label: string; match: (t: MarkType) => boolean };

const FILTERS: Filter[] = [
  { key: "all", label: "All", match: () => true },
  { key: "roasts", label: "Roasts", match: (t) => t === "roast" },
  { key: "photos", label: "Photos", match: (t) => t === "photo" || t === "memory" },
  { key: "awards", label: "Awards", match: (t) => t === "award" },
];

/**
 * My Wall — the hero. Header + a 2-column masonry of tilted, pinned marks that
 * loads from Supabase and updates live: when a friend leaves a mark it drops in
 * at the top. Filter chips narrow by type; an empty wall nudges "invite crew".
 */
export default function MyWall() {
  const { session, profile } = useAuth();
  // When we arrive here right after creating a mark, drop + highlight that one.
  const { justCreated } = useLocalSearchParams<{ justCreated?: string }>();
  const justCreatedId = justCreated ? String(justCreated) : null;

  const [wall, setWall] = useState<Wall | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const dropIds = useRef<Set<string>>(new Set(justCreated ? [String(justCreated)] : []));

  // Initial load: wall + marks + friend count.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!session?.user) return;
      const w = await getPersonalWall(session.user.id);
      if (!active || !w) {
        setLoading(false);
        return;
      }
      setWall(w);
      const [ms, friends] = await Promise.all([
        getWallMarks(w.id),
        supabase
          .from("friendships")
          .select("requester_id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`),
      ]);
      if (!active) return;
      setMarks(ms);
      setFriendCount(friends.count ?? 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // Live: newly-left marks arrive via the staggered arrival queue so a burst
  // cascades in (drop-in each) instead of ten dropping at once.
  useStaggeredArrivals(wall?.id, (m) => {
    dropIds.current.add(m.id);
    setMarks((cur) => (cur.some((x) => x.id === m.id) ? cur : [m, ...cur]));
  });

  // Reactions state for every mark on the wall (optimistic + realtime).
  const { summaries, toggle } = useWallReactions(marks, session?.user?.id);

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = useMemo(
    () => marks.filter((m) => activeFilter.match(m.type)),
    [marks, activeFilter],
  );

  const initial = (profile?.display_name?.[0] ?? "?").toUpperCase();

  const Header = useCallback(
    () => (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: colors.ink,
              backgroundColor: markColors.brandYellow,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text variant="display" style={{ fontSize: 24 }}>
                {initial}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="display" style={{ fontSize: 22 }}>
              {wall?.name ?? `${profile?.display_name ?? "My"}'s Wall`}
            </Text>
            <Text variant="label" color={colors.outline}>
              {marks.length} MARKS · {friendCount} FRIENDS
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Button label="Share my Wall 👀" variant="yellow" onPress={() => shareMyWall(profile?.handle)} />
          <Button label="Invite friends" variant="primary" onPress={() => inviteFriends(profile?.handle)} />
        </View>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 16, marginBottom: 18 }}>
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: colors.ink,
                  backgroundColor: on ? colors.ink : "transparent",
                }}
              >
                <Text variant="label" color={on ? colors.surface : colors.ink}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    ),
    [wall, profile, marks.length, friendCount, filter, initial],
  );

  return (
    <Screen>
      <Header />

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : marks.length === 0 ? (
        <View style={{ marginTop: 8 }}>
          <InviteCrew handle={profile?.handle} />
        </View>
      ) : visible.length === 0 ? (
        <Text variant="body" color={colors.outline} style={{ marginTop: 24, textAlign: "center" }}>
          No {activeFilter.label.toLowerCase()} yet.
        </Text>
      ) : (
        <Masonry
          data={visible}
          keyFor={(m) => m.id}
          estimate={estimateMarkHeight}
          renderItem={(m, index) => {
            const dropped = dropIds.current.has(m.id);
            return (
              <MarkView
                mark={m}
                enter={dropped ? "drop" : "settle"}
                enterIndex={index}
                highlight={m.id === justCreatedId}
                shareable
                wallHandle={profile?.handle}
                reactions={summaries[m.id]}
                onToggleReaction={(emoji) => toggle(m.id, emoji)}
              />
            );
          }}
        />
      )}

      <View style={{ height: 12 }} />
    </Screen>
  );
}
