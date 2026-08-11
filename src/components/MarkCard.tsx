import { useEffect, useMemo } from "react";
import { Platform, Pressable, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  androidEdge,
  border,
  colors,
  motion,
  radius,
  shadow,
  tiltFor,
  useReducedMotionFlag,
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
   * Elevation tier (Principle 2 — depth is a ranking language). "mark" = a real
   * Mark from another person (top tier); "seed" = the owner's own seed (middle,
   * quieter — the visual reading of AC-8).
   */
  tier?: "mark" | "seed";
  /** Tilt amplitude in degrees; loud types (roast) pass more. */
  tiltAmplitude?: number;
  /** Play the DROP entrance (a freshly created / live-arriving Mark). */
  dropIn?: boolean;
  /** Play the SETTLE entrance with this stagger delay (ms) on first paint. */
  settleDelay?: number;
  style?: ViewStyle;
};

/**
 * The core container for every Mark. Applies the signature look — a persistent
 * seeded tilt, the hard zero-blur offset shadow ("pinned paper"), an optional
 * 2px ink border, one fastener — and owns the Mark's entrance motion.
 *
 * Motion (all token-gated via `motion`, degrading to fade/instant under
 * reduced-motion — FP-001 §5):
 *  - DROP  (`dropIn`): falls from above → short overshoot → settles, with the
 *    hard shadow snapping in on landing. THE signature moment (VD-7).
 *  - SETTLE (`settleDelay`): a quick staggered fade + rise on a populated
 *    wall's first paint, so arriving feels like walking up to a full wall.
 *  - PRESS: presses down and collapses the shadow (the one shared tap language,
 *    generalized from `motion.duration`).
 */
export function MarkCard({
  id,
  children,
  background = colors.card,
  bordered = false,
  fastener = "tape",
  onPress,
  tier = "mark",
  tiltAmplitude,
  dropIn = false,
  settleDelay,
  style,
}: Props) {
  const reduced = useReducedMotionFlag();
  const rotation = useMemo(() => tiltFor(id, tiltAmplitude), [id, tiltAmplitude]);
  const tierShadow = tier === "seed" ? shadow.markSeed : shadow.mark;

  const pressed = useSharedValue(0);

  const wantsDrop = dropIn && !reduced;
  const wantsSettle = !dropIn && settleDelay != null && !reduced;

  // Entrance shared values. Initialized to the pre-entrance pose so the first
  // frame is already correct (no flash at the resting position).
  const ty = useSharedValue(
    wantsDrop ? motion.drop.startY : wantsSettle ? motion.settle.riseY : 0,
  );
  const op = useSharedValue(dropIn || settleDelay != null ? 0 : 1);
  const shadowMul = useSharedValue(wantsDrop ? 0 : 1);

  useEffect(() => {
    if (dropIn) {
      if (reduced) {
        op.value = withTiming(1, { duration: motion.duration.fade });
        return;
      }
      op.value = withTiming(1, { duration: motion.duration.shadowSnap });
      // Fall past the landing point (overshoot), then settle back to rest.
      ty.value = withSequence(
        withTiming(motion.drop.overshoot, {
          duration: motion.duration.dropFall,
          easing: motion.easing.fall,
        }),
        withTiming(0, {
          duration: motion.duration.dropSettle,
          easing: motion.easing.settle,
        }),
      );
      // Hard shadow snaps in on landing.
      shadowMul.value = withDelay(
        motion.duration.dropFall,
        withTiming(1, { duration: motion.duration.shadowSnap }),
      );
      return;
    }
    if (settleDelay != null) {
      if (reduced) {
        op.value = withTiming(1, { duration: motion.duration.fade });
        ty.value = 0;
        return;
      }
      op.value = withDelay(
        settleDelay,
        withTiming(1, { duration: motion.duration.settleRise, easing: motion.easing.settle }),
      );
      ty.value = withDelay(
        settleDelay,
        withTiming(0, { duration: motion.duration.settleRise, easing: motion.easing.settle }),
      );
    }
  }, [dropIn, settleDelay, reduced, op, ty, shadowMul]);

  // PRESS presses the card down and collapses its shadow; entrance transforms
  // are layered on top.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation}deg` },
      { translateY: pressed.value * 1 + ty.value },
    ],
    opacity: op.value,
    shadowOpacity: tierShadow.shadowOpacity * (1 - pressed.value) * shadowMul.value,
  }));

  const content = (
    <Animated.View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.card,
          padding: 14,
          marginBottom: 16,
          borderWidth: bordered ? border.width : 0,
          borderColor: border.color,
        },
        tierShadow,
        // Tokenized Android dual-edge fallback for the zero-blur offset shadow.
        Platform.OS === "android" ? androidEdge : null,
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
      onPressIn={() =>
        (pressed.value = withTiming(1, { duration: motion.duration.pressIn }))
      }
      onPressOut={() =>
        (pressed.value = withTiming(0, { duration: motion.duration.pressOut }))
      }
    >
      {content}
    </Pressable>
  );
}
