import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Masonry } from "@/components/Masonry";
import { InviteCrew } from "@/components/InviteCrew";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { MarkDetailModal } from "@/components/marks/MarkDetailModal";
import { WallStatus } from "@/components/WallStatus";
import { shareMyWall, inviteFriends } from "@/lib/share";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { getWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { getAccessibleSharedWalls } from "@/lib/walls";
import { SessionFocusFence } from "@/lib/session-generation";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { supabase } from "@/lib/supabase";
import type { MarkType, Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

type Filter = { key: string; label: string; match: (type: MarkType) => boolean };

const FILTERS: Filter[] = [
  { key: "all", label: "All", match: () => true },
  { key: "text", label: "Notes", match: (type) => type === "text" },
  { key: "photos", label: "Photos", match: (type) => type === "photo" },
];

/** Authenticated home: the user's real Personal Wall, not a separate feed/hub. */
export default function MyWall() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const { justCreated, focusMark } = useLocalSearchParams<{
    justCreated?: string;
    focusMark?: string;
  }>();
  const focusMarkId = String(focusMark ?? "") || null;
  const highlightedMarkId = String(justCreated ?? focusMarkId ?? "") || null;

  const [wall, setWall] = useState<Wall | null>(null);
  const [sharedWalls, setSharedWalls] = useState<Wall[]>([]);
  const [sharedWallsError, setSharedWallsError] = useState(false);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [focusedMarkUnavailable, setFocusedMarkUnavailable] = useState(false);
  const [selectedMark, setSelectedMark] = useState<MarkWithAuthor | null>(null);
  const dropIds = useRef<Set<string>>(new Set(justCreated ? [String(justCreated)] : []));
  const sharedWallsFence = useRef(new SessionFocusFence()).current;
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const refreshSharedWalls = useCallback(async () => {
    const token = sharedWallsFence.begin(userId ?? null);
    if (!token) return;
    setSharedWallsError(false);
    try {
      const nextSharedWalls = await getAccessibleSharedWalls(token.userId);
      if (!sharedWallsFence.isCurrent(token, currentUserId.current)) return;
      setSharedWalls(nextSharedWalls);
    } catch {
      if (!sharedWallsFence.isCurrent(token, currentUserId.current)) return;
      setSharedWalls([]);
      setSharedWallsError(true);
    }
  }, [sharedWallsFence, userId]);

  useFocusEffect(
    useCallback(() => {
      sharedWallsFence.focus(userId ?? null);
      if (!userId) {
        setSharedWalls([]);
        setSharedWallsError(false);
      } else {
        void refreshSharedWalls();
      }
      return () => {
        sharedWallsFence.blur();
        setSharedWalls([]);
        setSharedWallsError(false);
      };
    }, [refreshSharedWalls, sharedWallsFence, userId]),
  );

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) {
        setWall(null);
        setMarks([]);
        setSharedWalls([]);
        setSelectedMark(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setFocusedMarkUnavailable(false);
      setWall(null);
      setMarks([]);
      setSelectedMark(null);

      const personalWall = await getPersonalWall(userId);
      if (!active || !personalWall) {
        if (active) setLoading(false);
        return;
      }

      setWall(personalWall);
      const [nextMarks, friends] = await Promise.all([
        getWallMarks(personalWall.id),
        supabase
          .from("friendships")
          .select("requester_id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      ]);
      if (!active) return;
      setMarks(nextMarks);
      if (focusMarkId) {
        const focusedMark = nextMarks.find((mark) => mark.id === focusMarkId) ?? null;
        setSelectedMark(focusedMark);
        setFocusedMarkUnavailable(!focusedMark);
      }
      setFriendCount(friends.count ?? 0);
      setLoading(false);
    })().catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [focusMarkId, userId]);

  useStaggeredArrivals(wall?.id, (mark) => {
    dropIds.current.add(mark.id);
    setMarks((current) =>
      current.some((candidate) => candidate.id === mark.id) ? current : [mark, ...current],
    );
  });

  const { summaries, toggle } = useWallReactions(marks, session?.user?.id);
  const activeFilter = FILTERS.find((candidate) => candidate.key === filter) ?? FILTERS[0];
  const visible = useMemo(
    () => marks.filter((mark) => activeFilter.match(mark.type)),
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
              <Text variant="display" style={{ fontSize: 24 }}>{initial}</Text>
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

        <WallStatus wallId={wall?.id} viewerId={userId} isOwner />

        <View style={{ marginHorizontal: -20, marginTop: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
            accessibilityRole="tablist"
            accessibilityLabel="Choose a Wall"
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel="My Wall"
              accessibilityState={{ selected: true }}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: colors.ink,
                backgroundColor: colors.ink,
              }}
            >
              <Text variant="label" color={markColors.brandYellow}>MY WALL</Text>
            </Pressable>
            {sharedWalls.map((sharedWall) => (
              <Pressable
                key={sharedWall.id}
                accessibilityRole="tab"
                accessibilityLabel={`Open Shared Wall ${sharedWall.name}`}
                accessibilityState={{ selected: false }}
                onPress={() => router.push(`/shared/${sharedWall.id}`)}
                style={{
                  minHeight: 44,
                  maxWidth: 220,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: colors.ink,
                  backgroundColor: colors.surface,
                }}
              >
                <Text variant="label" numberOfLines={1}>{sharedWall.name.toUpperCase()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {sharedWallsError ? (
          <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginTop: 6 }}>
            Shared Walls aren&apos;t available right now.
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Button label="Share my Wall 👀" variant="yellow" onPress={() => shareMyWall(profile?.handle)} />
          <Button label="Invite friends" variant="primary" onPress={() => inviteFriends(profile?.handle)} />
        </View>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 16, marginBottom: 18 }}>
          {FILTERS.map((candidate) => {
            const selected = candidate.key === filter;
            return (
              <Pressable
                key={candidate.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${candidate.label.toLowerCase()} Marks`}
                onPress={() => setFilter(candidate.key)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: colors.ink,
                  backgroundColor: selected ? colors.ink : "transparent",
                }}
              >
                <Text variant="label" color={selected ? colors.surface : colors.ink}>
                  {candidate.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    ),
    [filter, friendCount, initial, marks.length, profile, router, sharedWalls, sharedWallsError, userId, wall],
  );

  return (
    <Screen>
      <Header />

      {focusedMarkUnavailable ? (
        <View
          accessibilityRole="alert"
          style={{
            borderWidth: 1.5,
            borderColor: colors.outline,
            borderRadius: radius.card,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text variant="headline">This isn&apos;t available anymore.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/discover")}
            style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }}
          >
            <Text variant="label">GO TO DISCOVER</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : marks.length === 0 ? (
        <View style={{ marginTop: 8 }}><InviteCrew handle={profile?.handle} /></View>
      ) : visible.length === 0 ? (
        <Text variant="body" color={colors.outline} style={{ marginTop: 24, textAlign: "center" }}>
          No {activeFilter.label.toLowerCase()} yet.
        </Text>
      ) : (
        <Masonry
          data={visible}
          keyFor={(mark) => mark.id}
          estimate={estimateMarkHeight}
          renderItem={(mark, index) => (
            <MarkView
              mark={mark}
              enter={dropIds.current.has(mark.id) ? "drop" : "settle"}
              enterIndex={index}
              highlight={mark.id === highlightedMarkId}
              shareable
              wallHandle={profile?.handle}
              isWallOwner
              reactions={summaries[mark.id]}
              onToggleReaction={(emoji) => toggle(mark.id, emoji)}
              onOpenDetail={() => setSelectedMark(mark)}
            />
          )}
        />
      )}

      <MarkDetailModal
        mark={selectedMark}
        viewerId={session?.user.id}
        wallOwnerId={wall?.owner_id}
        wallHandle={profile?.handle}
        shareable
        reactions={selectedMark ? summaries[selectedMark.id] : undefined}
        onToggleReaction={selectedMark ? (emoji) => toggle(selectedMark.id, emoji) : undefined}
        onClose={() => setSelectedMark(null)}
        onMarkUpdated={(markId, text) => {
          setMarks((current) => current.map((mark) => mark.id === markId ? { ...mark, text } : mark));
          setSelectedMark((current) => current?.id === markId ? { ...current, text } : current);
        }}
        onMarkRemoved={(markId) => setMarks((current) => current.filter((mark) => mark.id !== markId))}
      />

      <View style={{ height: 12 }} />
    </Screen>
  );
}
