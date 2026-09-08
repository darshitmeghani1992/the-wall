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
import {
  getMyWallMembership,
  getWall,
  getWallCapabilities,
  type WallCapabilities,
  type WallMember,
} from "@/lib/walls";
import { getWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { getProfile } from "@/lib/profiles";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { inviteToSharedWall, shareSharedWall } from "@/lib/share";
import type { Profile, Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

/**
 * Shared Wall view backed by the auth-bound capability RPC. Client checks only
 * shape the UI; the database remains the contribution/visibility authority.
 */
export default function SharedWallScreen() {
  const router = useRouter();
  const { id, justCreated, focusMark } = useLocalSearchParams<{
    id: string;
    justCreated?: string;
    focusMark?: string;
  }>();
  const justCreatedId = justCreated ? String(justCreated) : null;
  const focusMarkId = focusMark ? String(focusMark) : null;
  const { session } = useAuth();
  const [wall, setWall] = useState<Wall | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [capabilities, setCapabilities] = useState<WallCapabilities | null>(null);
  const [membership, setMembership] = useState<WallMember | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMark, setSelectedMark] = useState<MarkWithAuthor | null>(null);
  const [focusedMarkUnavailable, setFocusedMarkUnavailable] = useState(false);
  const dropIds = useRef<Set<string>>(new Set(justCreatedId ? [justCreatedId] : []));

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id || !session?.user.id) {
        setWall(null);
        setMarks([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setFocusedMarkUnavailable(false);
      setWall(null);
      setCapabilities(null);
      setMembership(null);
      setMarks([]);
      setSelectedMark(null);
      try {
        const [w, nextCapabilities, nextMembership] = await Promise.all([
          getWall(id),
          getWallCapabilities(id),
          getMyWallMembership(id, session.user.id),
        ]);
        if (!active) return;
        if (!w || w.type !== "shared" || !nextCapabilities || nextCapabilities.wallType !== "shared") {
          setError("This Shared Wall isn't available.");
          return;
        }
        setWall(w);
        setCapabilities(nextCapabilities);
        setMembership(nextMembership);
        const [ownerProfile, ms] = await Promise.all([getProfile(w.owner_id), getWallMarks(w.id)]);
        if (!active) return;
        setOwner(ownerProfile);
        setMarks(ms);
        if (focusMarkId) {
          const focusedMark = ms.find((mark) => mark.id === focusMarkId) ?? null;
          setSelectedMark(focusedMark);
          setFocusedMarkUnavailable(!focusedMark);
        }
      } catch (cause: any) {
        if (active) setError(cause?.message ?? "Couldn't open this Shared Wall.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [focusMarkId, id, session?.user.id]);

  useStaggeredArrivals(wall?.id, (mark) => {
    dropIds.current.add(mark.id);
    setMarks((cur) => (cur.some((m) => m.id === mark.id) ? cur : [mark, ...cur]));
  });

  const { summaries, toggle } = useWallReactions(marks, session?.user.id);

  const canLeaveMark = capabilities?.canContribute === true;
  const isOwner = capabilities?.isOwner === true;
  const isMember = membership?.status === "accepted";

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
              SHARED WALL · {wall.visibility === "public" ? "PUBLIC" : wall.visibility === "private" ? "PRIVATE" : "INVITE ONLY"}
            </Text>
          </View>

          <Text variant="display" style={{ fontSize: 26 }}>
            {wall.name}
          </Text>
          <Text variant="body" color={colors.outline} style={{ marginTop: 4 }}>
            {owner ? `Started by ${owner.display_name}` : "Shared Wall"} · {marks.length} marks · {isOwner ? "owner" : isMember ? "member" : "viewer"}
          </Text>

          {focusedMarkUnavailable ? (
            <Text accessibilityRole="alert" variant="body" color={colors.outline} style={{ marginTop: 12 }}>
              This Mark isn&apos;t available anymore.
            </Text>
          ) : null}

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
            {isOwner ? (
              <Button label="Invite" variant="primary" onPress={() => inviteToSharedWall(wall.id, wall.name)} />
            ) : null}
            <Button label="Share ↗" variant="ghost" onPress={() => shareSharedWall(wall.id, wall.name)} />
          </View>

          <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginBottom: 18 }}>
            {wall.visibility === "public"
              ? "Anyone signed in can view. Only the owner and accepted members can leave Marks."
              : "Only the owner and accepted members can view and leave Marks."}
          </Text>

          {!canLeaveMark ? (
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: 18 }}>
              Only accepted members can leave Marks here.
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
                {canLeaveMark
                  ? `Be the first to leave a Mark on ${wall.name}.`
                  : "This Shared Wall is waiting for its first Mark."}
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
