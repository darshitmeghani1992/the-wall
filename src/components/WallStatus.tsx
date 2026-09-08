import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Text } from "./Text";
import { getWallStatus, type WallStatusRecord } from "@/lib/status";
import { SessionFocusFence } from "@/lib/session-generation";
import { colors, markColors, radius } from "@/theme";

type Props = {
  wallId: string | null | undefined;
  viewerId: string | null | undefined;
  isOwner?: boolean;
};

/** One non-reactable Status on a Personal Wall; owner controls are contextual. */
export function WallStatus({ wallId, viewerId, isOwner = false }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<WallStatusRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(wallId && viewerId));
  const [error, setError] = useState(false);
  const fence = useRef(new SessionFocusFence()).current;
  const currentViewerId = useRef<string | null>(viewerId ?? null);
  currentViewerId.current = viewerId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(viewerId ?? null);
    if (!token || !wallId) return;
    setLoading(true);
    setError(false);
    try {
      const nextStatus = await getWallStatus(wallId);
      if (!fence.isCurrent(token, currentViewerId.current)) return;
      setStatus(nextStatus);
    } catch {
      if (!fence.isCurrent(token, currentViewerId.current)) return;
      setStatus(null);
      setError(true);
    } finally {
      if (fence.isCurrent(token, currentViewerId.current)) setLoading(false);
    }
  }, [fence, viewerId, wallId]);

  useFocusEffect(
    useCallback(() => {
      fence.focus(viewerId ?? null);
      setStatus(null);
      setError(false);
      if (!viewerId || !wallId) {
        setLoading(false);
      } else {
        void load();
      }
      return () => {
        fence.blur();
        setStatus(null);
        setError(false);
        setLoading(Boolean(wallId && viewerId));
      };
    }, [fence, load, viewerId, wallId]),
  );

  if (loading) {
    return (
      <View style={{ minHeight: 44, justifyContent: "center" }}>
        <ActivityIndicator color={markColors.brandYellow} />
      </View>
    );
  }

  if (error) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Status unavailable. Try again"
        onPress={() => void load()}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text variant="body" color={colors.error}>Status unavailable · Try again</Text>
      </Pressable>
    );
  }

  if (!status) {
    if (!isOwner || !wallId) return null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set a Status"
        onPress={() => router.push(`/status?wallId=${encodeURIComponent(wallId)}`)}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <Text variant="label" color={colors.outline}>+ SET A STATUS</Text>
      </Pressable>
    );
  }

  return (
    <View
      accessible={!isOwner}
      accessibilityLabel={`Status: ${status.body}`}
      style={{
        borderWidth: 1.5,
        borderColor: colors.ink,
        borderRadius: radius.card,
        backgroundColor: colors.card,
        padding: 14,
        marginTop: 12,
      }}
    >
      <Text variant="label" color={colors.outline}>STATUS</Text>
      <Text variant="mark" style={{ marginTop: 5 }}>{status.body}</Text>
      {isOwner && wallId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit Status"
          onPress={() => router.push(`/status?wallId=${encodeURIComponent(wallId)}`)}
          style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 4 }}
        >
          <Text variant="label" color={colors.outline}>EDIT STATUS</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
