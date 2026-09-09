import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { colors, markColors, radius } from "@/theme";
import type { Profile } from "@/lib/types";
import { Text } from "./Text";

export function PersonRow({
  profile,
  detail,
  action,
  secondaryAction,
  disabled,
  secondaryDisabled,
  onAction,
  onSecondaryAction,
  onPress,
}: {
  profile: Profile;
  detail?: string;
  action?: string;
  secondaryAction?: string;
  disabled?: boolean;
  secondaryDisabled?: boolean;
  onAction?: () => void;
  onSecondaryAction?: () => void;
  onPress?: () => void;
}) {
  const identity = (
    <>
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
        <Text variant="body" color={colors.outline} numberOfLines={1}>
          @{profile.handle}{detail ? ` · ${detail}` : ""}
        </Text>
      </View>
    </>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open @${profile.handle}'s Wall`}
          onPress={onPress}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50 }}
        >
          {identity}
        </Pressable>
      ) : (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50 }}>
          {identity}
        </View>
      )}
      {action || secondaryAction ? (
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${action} @${profile.handle}`}
              accessibilityState={{ disabled: disabled || !onAction }}
              disabled={disabled || !onAction}
              onPress={onAction}
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
          {secondaryAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${secondaryAction} @${profile.handle}`}
              accessibilityState={{ disabled: secondaryDisabled || !onSecondaryAction }}
              disabled={secondaryDisabled || !onSecondaryAction}
              onPress={onSecondaryAction}
              style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center", opacity: secondaryDisabled ? 0.5 : 1 }}
            >
              <Text variant="label" color={colors.outline}>{secondaryAction.toUpperCase()}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
