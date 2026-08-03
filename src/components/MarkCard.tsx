import { useMemo } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { border, colors, radius, shadow, tiltFor } from "@/theme";
import { Fastener } from "./Fastener";

type Props = {
  /** Stable id → deterministic tilt so the card doesn't jump on re-render. */
  id: string;
  children: React.ReactNode;
  background?: string;
  /** Roast marks always keep the 2px ink border; others opt in. */
  bordered?: boolean;
  fastener?: "pin" | "tape" | "none";
  onPress?: () => void;
  /** Play the "drop" entrance (used when a freshly created mark prepends). */
  dropIn?: boolean;
  style?: ViewStyle;
};

/**
 * The core container for every mark. Applies the signature look: a persistent
 * random tilt, a hard offset shadow ("pinned paper"), an optional 2px ink
 * border, and a fastener (pin/tape). Handles hover/press "lift & press" and the
 * drop-in entrance animation.
 */
export function MarkCard({
  id,
  children,
  background = colors.card,
  bordered = false,
  fastener = "tape",
  onPress,
  dropIn = false,
  style,
}: Props) {
  const rotation = useMemo(() => tiltFor(id), [id]);
  const pressed = useSharedValue(0);

  // Active state "presses" the card down and collapses its shadow.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation}deg` },
      { translateY: pressed.value * 1 },
    ],
    shadowOpacity: shadow.mark.shadowOpacity * (1 - pressed.value),
  }));

  const content = (
    <Animated.View
      entering={dropIn ? FadeIn.duration(320) : undefined}
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.card,
          padding: 14,
          marginBottom: 16,
          borderWidth: bordered ? border.width : 0,
          borderColor: border.color,
        },
        shadow.mark,
        animatedStyle,
        style,
      ]}
    >
      {fastener !== "none" && <Fastener kind={fastener} />}
      {children}
    </Animated.View>
  );

  if (!onPress) return <View>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 90 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
    >
      {content}
    </Pressable>
  );
}
