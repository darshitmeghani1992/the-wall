import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { colors, markColors, radius } from "@/theme";
import type { Profile } from "@/lib/types";
import { Text } from "./Text";

export function PersonRow({
  profile,
  action,
  disabled,
  onAction,
  onPress,
}: {
  profile: Profile;
  action?: string;
  disabled?: boolean;
  onAction?: () => void;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `Open @${profile.handle}'s Wall` : undefined}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: markColors.brandYellow,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text variant="display">{profile.display_name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>{profile.display_name}</Text>
        <Text variant="body" color={colors.outline}>@{profile.handle}</Text>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} @${profile.handle}`}
          disabled={disabled || !onAction}
          onPress={(event) => {
            event.stopPropagation();
            onAction?.();
          }}
          style={{
            minHeight: 44,
            minWidth: 78,
            paddingHorizontal: 12,
            borderRadius: radius.card,
            borderWidth: action === "Friends" || action === "Sent" ? 1 : 2,
            borderColor: colors.ink,
            backgroundColor: action === "Accept" ? markColors.brandYellow : colors.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text variant="label">{action}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
