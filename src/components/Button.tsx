import { Pressable, ActivityIndicator, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, markColors, motion, radius } from "@/theme";
import { Text } from "./Text";

type Variant = "primary" | "yellow" | "ghost";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Press-tilt discipline (VD §3): tilt on press is charming on Mark-adjacent
   * actions and gimmicky on a form's Submit. Off by default (chrome-clean);
   * opt in only for wall/Mark-adjacent CTAs. The press-down + shadow-collapse
   * feedback still applies either way.
   */
  tactile?: boolean;
};

/**
 * A button that looks like a physical label: primary is black on paper with a
 * hard offset shadow; it "presses" down when tapped (the shared PRESS language,
 * tokenized in `motion`). Yellow is the brand CTA; ghost is a quiet link.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  tactile = false,
}: Props) {
  const pressed = useSharedValue(0);

  const bg =
    variant === "primary" ? colors.ink : variant === "yellow" ? markColors.brandYellow : "transparent";
  const fg = variant === "primary" ? colors.white : colors.ink;

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: pressed.value * 2 },
      { rotate: `${pressed.value * (tactile ? -1.5 : 0)}deg` },
    ],
    shadowOpacity: (variant === "ghost" ? 0 : 0.16) * (1 - pressed.value),
  }));

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: motion.duration.pressIn }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: motion.duration.pressOut }))}
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
