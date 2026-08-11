import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Masonry } from "@/components/Masonry";
import { InviteCrew } from "@/components/InviteCrew";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { getWallMarks, subscribeToWall, type MarkWithAuthor } from "@/lib/marks";
import { supabase } from "@/lib/supabase";
import type { MarkType, Wall } from "@/lib/types";
import { colors, motion, radius } from "@/theme";
import { EmptyWall } from "./EmptyWall";

type Filter = { key: string; label: string; match: (t: MarkType) => boolean };

const FILTERS: Filter[] = [
  { key: "all", label: "All", match: () => true },
  { key: "roasts", label: "Roasts", match: (t) => t === "roast" },
  { key: "photos", label: "Photos", match: (t) => t === "photo" || t === "memory" },
  { key: "awards", label: "Awards", match: (t) => t === "award" },
];

/**
 * The Personal Wall — the honest hero, and (per Option C) the Home tab's whole
 * body. A header identity plate + a 2-column masonry of tilted, pinned Marks
 * that loads from Supabase and updates live: when someone leaves a Mark it DROPs
 * in at the top. Filter chips narrow by type.
 *
 * This is the shipped `app/wall.tsx` wall body, extracted verbatim in its
 * data/realtime/filter/masonry logic (Search-Before-Create — reuse, don't
 * rewrite) and re-dressed to the FP-001 visual direction:
 *  - empty → the honest two-action <EmptyWall/> (invite dominant + dedicated
 *    seed CTA + ghost placeholders), replacing the old buried InviteCrew;
 *  - the owner's own Marks render at the quieter "seed" elevation tier (isOwn),
 *    others' Marks at the top tier (Principle 2 / AC-8);
 *  - a just-created Mark DROPs; a populated first paint SETTLEs in stagger;
 *  - once seeded but with no Marks from others yet, gravity re-centers on
 *    Invite (a slim invite block below the masonry) — never a standing
 *    self-post affordance (the old "✦ LEAVE A MARK" self-target link is gone).
 *
 * `justCreatedId` (from `/home?justCreated=`) flags the seed/new Mark for DROP.
 */
export function PersonalWall({ justCreatedId }: { justCreatedId?: string }) {
  const router = useRouter();
  const { session, profile } = useAuth();

  const [wall, setWall] = useState<Wall | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const dropIds = useRef<Set<string>>(
    new Set(justCreatedId ? [String(justCreatedId)] : []),
  );
  // SETTLE only plays on the first populated paint, not on every filter switch.
  const settledRef = useRef(false);

  const uid = session?.user?.id ?? null;

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

  // Live: prepend newly-left marks (flagged so they DROP in).
  useEffect(() => {
    if (!wall) return;
    return subscribeToWall(wall.id, (m) => {
      dropIds.current.add(m.id);
      setMarks((cur) => (cur.some((x) => x.id === m.id) ? cur : [m, ...cur]));
    });
  }, [wall?.id]);

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = useMemo(
    () => marks.filter((m) => activeFilter.match(m.type)),
    [marks, activeFilter],
  );

  const isEmpty = marks.length === 0;
  // hasSeeded: the owner has authored ≥1 active Mark on their own wall. Derived
  // from the Marks the wall already loads — NO schema. Gates only the seed CTA.
  const hasSeeded = useMemo(
    () => (uid ? marks.some((m) => m.author_id === uid) : false),
    [marks, uid],
  );
  // Whether anyone else has written yet — decides if invite gravity stays.
  const hasOthers = useMemo(
    () => (uid ? marks.some((m) => m.author_id !== uid) : marks.length > 0),
    [marks, uid],
  );

  // First populated paint → stagger a SETTLE per card (by visible order).
  const settleIndex = useMemo(() => {
    const map = new Map<string, number>();
    visible.forEach((m, i) => map.set(m.id, i));
    return map;
  }, [visible]);

  useEffect(() => {
    if (!loading && !isEmpty) settledRef.current = true;
  }, [loading, isEmpty]);

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
              // Neutral identity plate — brandYellow is reserved for Invite (VD §3).
              backgroundColor: colors.surfaceContainerHigh,
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

        {/* Filters are only meaningful once there are Marks to filter. */}
        {!isEmpty ? (
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
        ) : (
          <View style={{ height: 8 }} />
        )}
      </>
    ),
    [wall, profile, marks.length, friendCount, filter, initial, isEmpty],
  );

  return (
    <Screen>
      <Header />

      {loading ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      ) : isEmpty ? (
        <EmptyWall
          handle={profile?.handle}
          displayName={profile?.display_name}
          hasSeeded={hasSeeded}
          onSeed={() => router.push("/create")}
        />
      ) : (
        <>
          {visible.length === 0 ? (
            <Text variant="body" color={colors.outline} style={{ marginTop: 24, textAlign: "center" }}>
              No {activeFilter.label.toLowerCase()} yet.
            </Text>
          ) : (
            <Masonry
              data={visible}
              keyFor={(m) => m.id}
              estimate={estimateMarkHeight}
              renderItem={(m) => (
                <MarkView
                  mark={m}
                  isOwn={m.author_id === uid}
                  dropIn={dropIds.current.has(m.id)}
                  settleDelay={
                    !settledRef.current && !dropIds.current.has(m.id)
                      ? Math.min(settleIndex.get(m.id) ?? 0, motion.settle.maxSteps) *
                        motion.duration.settleStagger
                      : undefined
                  }
                />
              )}
            />
          )}

          {/*
           * Post-seed re-center (AC-5 / §11): once the wall has content but no
           * one else has written yet (only the owner's own seed), gravity
           * returns to Invite. This is NOT a standing self-post affordance —
           * it's the invite action, which is always allowed and always the
           * point of the empty/cold-start wall (AC-8 honored).
           */}
          {!hasOthers ? (
            <View style={{ marginTop: 20, marginBottom: 4 }}>
              <InviteCrew handle={profile?.handle} displayName={profile?.display_name} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
