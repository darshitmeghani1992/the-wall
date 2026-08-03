import { Pressable, ActivityIndicator, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, markColors, radius } from "@/theme";
import { Text } from "./Text";

type Variant = "primary" | "yellow" | "ghost";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * A button that looks like a physical label (handoff §Buttons & Inputs):
 * primary is black on paper with a hard offset shadow; it "presses" down and
 * tilts slightly when tapped. Yellow is the brand CTA; ghost is a quiet link.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: Props) {
  const pressed = useSharedValue(0);

  const bg =
    variant === "primary" ? colors.ink : variant === "yellow" ? markColors.brandYellow : "transparent";
  const fg = variant === "primary" ? colors.white : colors.ink;

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * 2 }, { rotate: `${pressed.value * -1.5}deg` }],
    shadowOpacity: (variant === "ghost" ? 0 : 0.16) * (1 - pressed.value),
  }));

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
    >
      <Animated.View
        style={[
          {
            backgroundColor: bg,
            borderRadius: radius.card,
            paddingVertical: 15,
            paddingHorizontal: 20,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.45 : 1,
            borderWidth: variant === "ghost" ? 0 : 2,
            borderColor: colors.ink,
            shadowColor: "#000",
            shadowOffset: { width: 4, height: 4 },
            shadowRadius: 0,
          },
          animated,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text variant="headline" color={fg}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
