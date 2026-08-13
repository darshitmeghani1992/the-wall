import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationMessage,
  notificationRoute,
  type NotificationWithActor,
} from "@/lib/notifications";
import { colors, markColors, radius } from "@/theme";

/** Compact relative time ("just now", "5m", "3h", "2d", else a date). */
function relativeTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * In-app notifications read surface. Lists the signed-in user's notifications
 * (RLS: own rows only) and marks them read on open.
 *
 * HONEST EMPTY STATE: rows are populated by C2 backend triggers that don't exist
 * yet, so this list is legitimately empty until then — the empty state says so
 * plainly. This screen never seeds or fakes a notification.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listNotifications(userId);
      setItems(rows);
      // Opening the surface clears the badge; rows keep the read/unread styling
      // from what we just loaded so the user can still see what's new.
      if (rows.some((r) => !r.read)) void markAllNotificationsRead(userId);
    } catch (cause: any) {
      setError(cause?.message ?? "Couldn't load your notifications.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function open(n: NotificationWithActor) {
    if (!n.read) void markNotificationRead(n.id);
    router.push(notificationRoute(n));
  }

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
          marginBottom: 18,
        }}
      >
        <Text variant="display" style={{ fontSize: 24 }}>
          Notifications
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="label" color={colors.outline}>
            CLOSE
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text variant="body" color={colors.error} style={{ marginTop: 24 }}>
          {error}
        </Text>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 48, alignItems: "center", gap: 6 }}>
          <Text variant="headline">No notifications yet</Text>
          <Text variant="body" color={colors.outline} style={{ textAlign: "center" }}>
            When people react to, comment on, or leave Marks on your Wall, you&apos;ll see it here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={notificationMessage(n)}
              onPress={() => open(n)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: n.read ? colors.outlineVariant : colors.ink,
                backgroundColor: n.read ? colors.surface : colors.surfaceContainerLow,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: colors.ink,
                  backgroundColor: markColors.brandYellow,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {n.actor?.avatar_url ? (
                  <Image source={{ uri: n.actor.avatar_url }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text variant="headline">{(n.actor?.display_name?.[0] ?? "?").toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body">{notificationMessage(n)}</Text>
                <Text variant="label" color={colors.outline} style={{ marginTop: 2 }}>
                  {relativeTime(n.created_at)}
                </Text>
              </View>
              {!n.read ? (
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: markColors.brandYellow }}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
