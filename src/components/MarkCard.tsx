import { useMemo } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  border,
  colors,
  enterDistance,
  markColors,
  motionTokens,
  radius,
  shadow,
  tiltFor,
  useEnterProgress,
  useHighlightPulse,
  type EnterMode,
} from "@/theme";
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
  /**
   * Entrance style: "drop" for a realtime / just-posted Mark (falls in with an
   * overshoot), "settle" for the staggered wall-load rise, "none" for static.
   */
  enter?: EnterMode;
  /** Position in the wall, used to stagger the "settle" entrance. */
  enterIndex?: number;
  /** Briefly pulse this card to draw the eye (the just-posted Mark). */
  highlight?: boolean;
  style?: ViewStyle;
};

/**
 * The core container for every mark. Applies the signature look: a persistent
 * random tilt, a hard offset shadow ("pinned paper"), an optional 2px ink
 * border, and a fastener (pin/tape). Handles the tactile press, the DROP/SETTLE
 * entrance, and the just-posted highlight pulse — all sourced from the motion
 * system (`src/theme/motion.ts`) and all reduced-motion aware.
 */
export function MarkCard({
  id,
  children,
  background = colors.card,
  bordered = false,
  fastener = "tape",
  onPress,
  enter = "none",
  enterIndex = 0,
  highlight = false,
  style,
}: Props) {
  const rotation = useMemo(() => tiltFor(id), [id]);
  const pressed = useSharedValue(0);

  const progress = useEnterProgress(enter, enterIndex);
  const pulse = useHighlightPulse(highlight);
  const distance = enterDistance(enter);
  const animated = enter !== "none";

  // Compose entrance (translateY/opacity/shadow) + tactile press + the persistent
  // tilt + the highlight pulse into one style so nothing fights over `transform`.
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // p < 1 → still falling (above rest); p > 1 → overshoot (below rest).
    const enterY = animated ? (1 - p) * -distance : 0;
    const enterOpacity = animated ? Math.min(1, Math.max(0, p * 1.5)) : 1;
    const shadowScale = animated ? Math.min(1, Math.max(0, p)) : 1;
    const scale = 1 + pulse.value * (motionTokens.highlight.scale - 1);

    return {
      opacity: enterOpacity,
      transform: [
        { rotate: `${rotation}deg` },
        { translateY: enterY + pressed.value * motionTokens.press.translate },
        { scale },
      ],
      shadowOpacity: shadow.mark.shadowOpacity * (1 - pressed.value) * shadowScale,
    };
  });

  // A brief ink outline that fades with the pulse for the just-posted Mark;
  // when not highlighting, `pulse` stays 0 so this is invisible.
  const highlightBorderStyle = useAnimatedStyle(() => ({
    // Roast keeps its solid ink border always; others only flash one on highlight.
    borderColor: bordered ? border.color : `rgba(11,12,12,${pulse.value})`,
    borderWidth: bordered ? border.width : pulse.value * border.width,
  }));

  const washStyle = useAnimatedStyle(() => ({ opacity: pulse.value * 0.16 }));

  const content = (
    <Animated.View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.card,
          padding: 14,
          marginBottom: 16,
          borderColor: border.color,
        },
        shadow.mark,
        animatedStyle,
        highlightBorderStyle,
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: radius.card,
            backgroundColor: markColors.brandYellow,
          },
          washStyle,
        ]}
      />
      {fastener !== "none" && <Fastener kind={fastener} />}
      {children}
    </Animated.View>
  );

  if (!onPress) return <View>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        (pressed.value = withTiming(1, { duration: motionTokens.press.downDuration }))
      }
      onPressOut={() =>
        (pressed.value = withTiming(0, { duration: motionTokens.press.upDuration }))
      }
    >
      {content}
    </Pressable>
  );
}
