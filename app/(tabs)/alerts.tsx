import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationMessage,
  notificationRoute,
  type NotificationWithActor,
} from "@/lib/notifications";
import { colors, markColors, radius } from "@/theme";

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

/** In-app Alerts backed only by the signed-in recipient's RLS-filtered rows. */
export default function AlertsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fence = useRef(new SessionFocusFence()).current;
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listNotifications(token.userId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setItems(rows);
      if (rows.some((row) => !row.read)) {
        try {
          if (!fence.isCurrent(token, currentUserId.current)) return;
          await markAllNotificationsRead(token.userId);
        } catch {
          // Reading Alerts remains available if the non-critical receipt fails.
        }
      }
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't load your Alerts.");
      }
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [fence, userId]);

  useFocusEffect(
    useCallback(() => {
      fence.focus(userId ?? null);
      if (!userId) {
        setItems([]);
        setError(null);
        setLoading(false);
      } else {
        void load();
      }
      return () => {
        fence.blur();
        setItems([]);
        setError(null);
        setLoading(true);
      };
    }, [fence, load, userId]),
  );

  async function open(notification: NotificationWithActor) {
    if (!userId || notification.user_id !== userId) return;
    const token = fence.begin(userId);
    if (!token) return;
    if (!notification.read) {
      try {
        await markNotificationRead(notification.id);
      } catch {
        // Navigation remains useful when the non-critical read receipt fails.
      }
    }
    if (!fence.isCurrent(token, currentUserId.current)) return;
    router.push(notificationRoute(notification));
  }

  return (
    <Screen>
      <Text variant="display" style={{ fontSize: 26, marginTop: 20, marginBottom: 18 }}>
        Alerts
      </Text>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={{ alignItems: "center", marginTop: 32, gap: 12 }}>
          <Text variant="body" color={colors.error} style={{ textAlign: "center" }}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading Alerts again"
            onPress={() => void load()}
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16 }}
          >
            <Text variant="label">TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 48, alignItems: "center", gap: 6 }}>
          <Text variant="headline">No Alerts yet</Text>
          <Text variant="body" color={colors.outline} style={{ textAlign: "center" }}>
            New Marks, reactions, friend requests, and Shared Wall invites will appear here.
          </Text>
        </View>
      ) : (
        <View accessibilityRole="list" style={{ gap: 10 }}>
          {items.map((notification) => (
            <Pressable
              key={notification.id}
              accessibilityRole="button"
              accessibilityLabel={`${notificationMessage(notification)}, ${relativeTime(notification.created_at)}`}
              onPress={() => void open(notification)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 64,
                padding: 12,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: notification.read ? colors.outlineVariant : colors.ink,
                backgroundColor: notification.read ? colors.surface : colors.surfaceContainerLow,
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
                {notification.actor?.avatar_url ? (
                  <Image
                    source={{ uri: notification.actor.avatar_url }}
                    accessibilityLabel={notification.actor.display_name}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <Text variant="headline">
                    {(notification.actor?.display_name?.[0] ?? "?").toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body">{notificationMessage(notification)}</Text>
                <Text variant="label" color={colors.outline} style={{ marginTop: 2 }}>
                  {relativeTime(notification.created_at)}
                </Text>
              </View>
              {!notification.read ? (
                <View
                  accessible={false}
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
