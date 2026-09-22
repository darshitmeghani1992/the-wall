import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import { appendUniqueNotifications, applyNotificationReadReceipts, relativeNotificationTime } from "@/lib/notification-ui";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationMessage,
  notificationRoute,
  type NotificationCursor,
  type NotificationWithActor,
} from "@/lib/notifications";
import { colors, markColors, radius } from "@/theme";

/** In-app Alerts backed only by the signed-in recipient's RLS-filtered rows. */
export default function AlertsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const fence = useRef(new SessionFocusFence()).current;
  const pageLoadToken = useRef<ReturnType<SessionFocusFence["begin"]>>(null);
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    if (!token) return;
    pageLoadToken.current = null;
    setLoadingOlder(false);
    setLoading(true);
    setError(null);
    setDetailsError(null);
    setOlderError(null);
    try {
      const page = await listNotifications(token.userId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      if (page.metadataIncomplete) {
        setDetailsError("Some Alert details couldn't be loaded. Your Alerts are still available.");
      }
      try {
        if (!fence.isCurrent(token, currentUserId.current)) return;
        const readIds = await markAllNotificationsRead(token.userId);
        if (!fence.isCurrent(token, currentUserId.current)) return;
        setItems((current) => applyNotificationReadReceipts(current, readIds));
      } catch {
        // Reading Alerts remains available if the non-critical receipt fails.
      }
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't load your Alerts.");
      }
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [fence, userId]);

  const loadOlder = useCallback(async () => {
    if (!userId || !nextCursor || loading || pageLoadToken.current) return;
    const token = fence.begin(userId);
    if (!token) return;
    pageLoadToken.current = token;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await listNotifications(token.userId, nextCursor);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setItems((current) => appendUniqueNotifications(current, page.items));
      setNextCursor(page.nextCursor);
      if (page.metadataIncomplete) {
        setDetailsError("Some Alert details couldn't be loaded. Your Alerts are still available.");
      }
    } catch (cause) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setOlderError(cause instanceof Error ? cause.message : "Couldn't load older Alerts.");
      }
    } finally {
      if (pageLoadToken.current === token) {
        pageLoadToken.current = null;
        setLoadingOlder(false);
      }
    }
  }, [fence, loading, nextCursor, userId]);

  useFocusEffect(
    useCallback(() => {
      fence.focus(userId ?? null);
      pageLoadToken.current = null;
      if (!userId) {
        setItems([]);
        setNextCursor(null);
        setError(null);
        setDetailsError(null);
        setOlderError(null);
        setLoadingOlder(false);
        setLoading(false);
      } else {
        void load();
      }
      return () => {
        fence.blur();
        pageLoadToken.current = null;
        setItems([]);
        setNextCursor(null);
        setError(null);
        setDetailsError(null);
        setOlderError(null);
        setLoadingOlder(false);
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
        const readId = await markNotificationRead(token.userId, notification.id);
        if (!fence.isCurrent(token, currentUserId.current)) return;
        setItems((current) => applyNotificationReadReceipts(current, [readId]));
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
        <View style={{ paddingVertical: 48, gap: 12 }}>
          <Text variant="headline">No Alerts yet</Text>
          <Text variant="body" color={colors.outline}>
            New Marks, reactions, friend requests, and Shared Wall invites will appear here.
          </Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button label="Go to My Wall" variant="yellow" onPress={() => router.push("/(tabs)/home")} />
            <Button label="Discover people" variant="ghost" onPress={() => router.push("/(tabs)/discover")} />
          </View>
        </View>
      ) : (
        <View accessibilityRole="list" style={{ gap: 10 }}>
          {detailsError ? (
            <Text accessibilityRole="alert" variant="body" color={colors.outline}>{detailsError}</Text>
          ) : null}
          {items.map((notification) => (
            <Pressable
              key={notification.id}
              accessibilityRole="button"
              accessibilityLabel={`${notificationMessage(notification)}, ${relativeNotificationTime(notification.created_at)}`}
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
                  {relativeNotificationTime(notification.created_at)}
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
          {olderError ? (
            <Text accessibilityRole="alert" variant="body" color={colors.error}>{olderError}</Text>
          ) : null}
          {nextCursor ? (
            <Button
              label={loadingOlder ? "Loading older Alerts…" : "Load older Alerts"}
              variant="ghost"
              disabled={loadingOlder}
              onPress={() => void loadOlder()}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
