import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Masonry } from "@/components/Masonry";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { MarkDetailModal } from "@/components/marks/MarkDetailModal";
import { useAuth } from "@/lib/auth";
import { getWall } from "@/lib/walls";
import { getWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { getProfile } from "@/lib/profiles";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { inviteToSharedWall, shareSharedWall } from "@/lib/share";
import type { Profile, Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

/**
 * Shared Wall view — the PUBLIC slice. Reuses the Masonry + MarkView wall surface
 * with staggered realtime arrivals and reactions. Shows the wall name, its owner,
 * its Marks, and the Invite / Share / "Leave a Mark on {name}" CTAs.
 *
 * The "can leave a Mark" check here is UX convenience only — the REAL boundary is
 * the server's `can_contribute` RLS on the marks INSERT. Member rosters, private
 * access, and member counts/avatars are C2 (need `wall_members`), so this screen
 * shows none of them rather than faking membership.
 */
export default function SharedWallScreen() {
  const router = useRouter();
  const { id, justCreated } = useLocalSearchParams<{ id: string; justCreated?: string }>();
  const justCreatedId = justCreated ? String(justCreated) : null;
  const { session } = useAuth();
  const [wall, setWall] = useState<Wall | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMark, setSelectedMark] = useState<MarkWithAuthor | null>(null);
  const dropIds = useRef<Set<string>>(new Set(justCreatedId ? [justCreatedId] : []));

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const w = await getWall(id);
        if (!active) return;
        if (!w || w.type !== "shared") {
          setError("This Shared Wall isn't available.");
          return;
        }
        setWall(w);
        const [ownerProfile, ms] = await Promise.all([getProfile(w.owner_id), getWallMarks(w.id)]);
        if (!active) return;
        setOwner(ownerProfile);
        setMarks(ms);
      } catch (cause: any) {
        if (active) setError(cause?.message ?? "Couldn't open this Shared Wall.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useStaggeredArrivals(wall?.id, (mark) => {
    dropIds.current.add(mark.id);
    setMarks((cur) => (cur.some((m) => m.id === mark.id) ? cur : [mark, ...cur]));
  });

  const { summaries, toggle } = useWallReactions(marks, session?.user.id);

  const canLeaveMark = Boolean(wall) && wall?.contribution_policy !== "nobody";
  const isOwner = Boolean(wall && session?.user.id === wall.owner_id);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <Text variant="label" color={colors.outline}>
          ‹ BACK
        </Text>
      </Pressable>

      {error || !wall ? (
        <Text variant="body" color={colors.error} style={{ marginTop: 12 }}>
          {error ?? "This Shared Wall isn't available."}
        </Text>
      ) : (
        <>
          <View
            style={{
              backgroundColor: colors.ink,
              padding: 10,
              borderRadius: radius.card,
              marginTop: 8,
              marginBottom: 16,
            }}
          >
            <Text variant="label" color={markColors.brandYellow} style={{ textAlign: "center" }}>
              SHARED WALL · PUBLIC
            </Text>
          </View>

          <Text variant="display" style={{ fontSize: 26 }}>
            {wall.name}
          </Text>
          <Text variant="body" color={colors.outline} style={{ marginTop: 4 }}>
            {owner ? `Started by ${owner.display_name}` : "Shared Wall"} · {marks.length} marks
          </Text>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 16, marginBottom: 16 }}>
            {canLeaveMark ? (
              <Button
                label={`Leave a Mark on ${wall.name}`}
                variant="yellow"
                onPress={() =>
                  router.push(`/create?sharedWallId=${wall.id}&wallName=${encodeURIComponent(wall.name)}`)
                }
              />
            ) : null}
            <Button label="Invite" variant="primary" onPress={() => inviteToSharedWall(wall.id, wall.name)} />
            <Button label="Share ↗" variant="ghost" onPress={() => shareSharedWall(wall.id, wall.name)} />
          </View>

          {isOwner ? (
            <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginBottom: 18 }}>
              Anyone with the link can view and add to this public Shared Wall. Private walls and member
              controls are coming soon.
            </Text>
          ) : null}

          {marks.length ? (
            <Masonry
              data={marks}
              keyFor={(m) => m.id}
              estimate={estimateMarkHeight}
              renderItem={(m, index) => (
                <MarkView
                  mark={m}
                  enter={dropIds.current.has(m.id) ? "drop" : "settle"}
                  enterIndex={index}
                  highlight={m.id === justCreatedId}
                  reactions={summaries[m.id]}
                  onToggleReaction={(emoji) => toggle(m.id, emoji)}
                  onOpenDetail={() => setSelectedMark(m)}
                />
              )}
            />
          ) : (
            <View style={{ paddingVertical: 36, alignItems: "center" }}>
              <Text variant="headline">No Marks yet</Text>
              <Text variant="body" color={colors.outline} style={{ marginTop: 6, textAlign: "center" }}>
                Be the first to leave a Mark on {wall.name}.
              </Text>
            </View>
          )}
          <MarkDetailModal
            mark={selectedMark}
            viewerId={session?.user.id}
            wallOwnerId={wall.owner_id}
            reactions={selectedMark ? summaries[selectedMark.id] : undefined}
            onToggleReaction={selectedMark ? (emoji) => toggle(selectedMark.id, emoji) : undefined}
            onClose={() => setSelectedMark(null)}
            onMarkUpdated={(markId, text) => {
              setMarks((current) => current.map((item) => item.id === markId ? { ...item, text } : item));
              setSelectedMark((current) => current?.id === markId ? { ...current, text } : current);
            }}
            onMarkRemoved={(markId) => setMarks((current) => current.filter((item) => item.id !== markId))}
          />
        </>
      )}
    </Screen>
  );
}
