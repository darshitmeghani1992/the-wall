import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { colors, markColors, radius, shadow, spacing } from "@/theme";

/** A small, honest way into the core loop: the user's Wall or their people. */
export default function HomeScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const firstName = profile?.display_name?.split(" ")[0] ?? "there";
  const [unread, setUnread] = useState(0);

  // Refresh the unread badge whenever Home regains focus. Legitimately stays 0
  // until the C2 triggers start populating the notifications table.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (userId) {
        getUnreadCount(userId)
          .then((count) => {
            if (active) setUnread(count);
          })
          .catch(() => {});
      }
      return () => {
        active = false;
      };
    }, [userId]),
  );

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.gutter }}>
        <Text variant="display">the wall</Text>
        <Pressable
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          hitSlop={8}
          style={{ minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" }}
        >
          <View>
            <Icon name="bell" size={24} color={colors.ink} />
            {unread > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 3,
                  backgroundColor: colors.error,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text color={colors.white} style={{ fontSize: 9, lineHeight: 12, fontWeight: "700" }}>
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
      <Text variant="mark" style={{ marginTop: 28 }}>Hey, {firstName}</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 28 }}>
        Your people leave the best stories on your Wall.
      </Text>

      <Pressable onPress={() => router.push("/wall")}>
        <View style={[{ backgroundColor: markColors.brandYellow, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, padding: 20 }, shadow.cta]}>
          <Text variant="label">MY WALL</Text>
          <Text variant="display" style={{ fontSize: 25, marginTop: 4 }}>See what they left →</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => router.push("/(tabs)/discover")} style={{ minHeight: 64, justifyContent: "center", marginTop: 18 }}>
        <Text variant="headline">Find your people</Text>
        <Text variant="body" color={colors.outline}>Search handles, answer requests, visit friends' Walls.</Text>
      </Pressable>
    </Screen>
  );
}
