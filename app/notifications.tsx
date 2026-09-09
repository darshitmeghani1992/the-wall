import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationMessage,
  notificationRoute,
  type NotificationWithActor,
} from "@/lib/notifications";
import { acceptWallMembership, getPendingInvites, type PendingInvite } from "@/lib/walls";
import { colors, markColors, radius } from "@/theme";

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

export default function NotificationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, pendingInvites] = await Promise.all([
        listNotifications(userId),
        getPendingInvites(userId),
      ]);
      setItems(rows);
      setInvites(pendingInvites);
      if (rows.some((row) => !row.read)) void markAllNotificationsRead(userId);
    } catch (cause: any) {
      setError(cause?.message ?? "Couldn't load your Alerts.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function open(n: NotificationWithActor) {
    if (!n.read) void markNotificationRead(n.id);
    router.push(notificationRoute(n));
  }

  async function acceptInvite(invite: PendingInvite) {
    setInviteBusyId(invite.wall_id);
    try {
      await acceptWallMembership(invite.wall_id);
      setInvites((current) => current.filter((item) => item.wall_id !== invite.wall_id));
      router.push(`/shared/${invite.wall_id}`);
    } catch (cause: any) {
      Alert.alert("Couldn't accept invite", cause?.message ?? "That invite may no longer be available.");
    } finally {
      setInviteBusyId(null);
    }
  }

  const empty = invites.length === 0 && items.length === 0;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 18 }}>
        <Text variant="display" style={{ fontSize: 24 }}>Alerts</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close Alerts"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="label" color={colors.outline}>CLOSE</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text variant="body" color={colors.error} style={{ marginTop: 24 }}>{error}</Text>
      ) : empty ? (
        <View style={{ paddingVertical: 48, alignItems: "center", gap: 6 }}>
          <Text variant="headline">No Alerts yet</Text>
          <Text variant="body" color={colors.outline} style={{ textAlign: "center" }}>
            New Marks, reactions, friend activity and Shared Wall invites will appear here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          {invites.length ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" color={colors.outline}>SHARED WALL INVITES · {invites.length}</Text>
              {invites.map((invite) => (
                <View
                  key={invite.wall_id}
                  style={{ borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, padding: 14, backgroundColor: colors.surfaceContainerLow }}
                >
                  <Text variant="headline">{invite.wall?.name ?? "Private Shared Wall"}</Text>
                  <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 4, marginBottom: 12 }}>
                    You were invited to join this Shared Wall. Access starts only after you accept.
                  </Text>
                  <Button
                    label="Accept invite"
                    variant="yellow"
                    loading={inviteBusyId === invite.wall_id}
                    disabled={Boolean(inviteBusyId)}
                    onPress={() => acceptInvite(invite)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {items.length ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" color={colors.outline}>RECENT ACTIVITY</Text>
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
                  <View style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: markColors.brandYellow, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                    {n.actor?.avatar_url ? (
                      <Image source={{ uri: n.actor.avatar_url }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <Text variant="headline">{(n.actor?.display_name?.[0] ?? "?").toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body">{notificationMessage(n)}</Text>
                    <Text variant="label" color={colors.outline} style={{ marginTop: 2 }}>{relativeTime(n.created_at)}</Text>
                  </View>
                  {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: markColors.brandYellow }} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
