/**
 * Motion system — the single source of truth for how Marks move.
 *
 * The Wall's aesthetic is "physical digital": paper pinned to a wall. Motion
 * reinforces that — Marks DROP onto the wall (fall, a slight overshoot, then
 * settle as their shadow lands), a freshly-loaded wall SETTLEs its Marks in with
 * a subtle, staggered rise, and pressing a Mark gives a restrained tactile push.
 *
 * Everything here is reduced-motion aware: when the OS asks for reduced motion
 * (reanimated's `useReducedMotion()`), entrances degrade to a quick fade / an
 * instant state instead of translating, so the app stays usable and calm for
 * motion-sensitive users (WCAG 2.3.3).
 *
 * NOTE (cross-work overlap): FP-001 (unmerged PR #7) introduces a parallel
 * motion system. If both land, these two must be reconciled into one — this is
 * the canonical token/hook home to consolidate onto. Flagged, not merged here.
 */
import { useEffect } from "react";
import {
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
  type WithSpringConfig,
} from "react-native-reanimated";

/** How a card enters the wall. */
export type EnterMode = "drop" | "settle" | "none";

/** Motion tokens — timings/distances live here, never hard-coded per component. */
export const motionTokens = {
  /** Realtime / just-posted Mark: a pronounced fall with a springy overshoot. */
  drop: {
    distance: 22, // px it falls from (above resting)
    spring: { damping: 12, stiffness: 170, mass: 0.9 } as WithSpringConfig,
  },
  /** Initial wall load: a subtler rise, staggered so the wall "assembles". */
  settle: {
    distance: 10,
    stagger: 42, // ms between successive cards
    maxSteps: 12, // cap so a long wall never waits seconds
    spring: { damping: 15, stiffness: 150, mass: 0.8 } as WithSpringConfig,
  },
  /** Restrained press: how far a Mark/Button pushes down when held. */
  press: {
    translate: 1.5,
    downDuration: 90,
    upDuration: 130,
  },
  /** Just-posted highlight pulse (scale) + how long it lingers. */
  highlight: {
    scale: 1.03,
    inDuration: 220,
    hold: 950,
    outDuration: 260,
    spring: { damping: 14, stiffness: 180, mass: 0.7 } as WithSpringConfig,
  },
  /** Fallback fade duration used whenever reduced-motion is on. */
  reducedFade: 150,
} as const;

/**
 * Drives a 0→1 entrance progress for one card. `withSpring` naturally overshoots
 * past 1 then settles, which is exactly the "drop → overshoot → settle" feel —
 * the consuming component maps that progress to translateY/opacity/shadow.
 *
 * Reduced motion: skips the spring entirely and eases opacity in, no translate.
 * `none`: resolves to 1 immediately (no entrance).
 */
export function useEnterProgress(mode: EnterMode, index = 0): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(mode === "none" ? 1 : 0);

  useEffect(() => {
    if (mode === "none") {
      progress.value = 1;
      return;
    }
    if (reduced) {
      progress.value = withTiming(1, { duration: motionTokens.reducedFade });
      return;
    }
    if (mode === "drop") {
      progress.value = withSpring(1, motionTokens.drop.spring);
      return;
    }
    // settle — staggered by position, capped so late cards don't lag for seconds.
    const step = Math.min(index, motionTokens.settle.maxSteps);
    progress.value = withDelay(
      step * motionTokens.settle.stagger,
      withSpring(1, motionTokens.settle.spring),
    );
    // progress is a stable shared-value ref; listed to satisfy exhaustive-deps.
  }, [mode, index, reduced, progress]);

  return progress;
}

/**
 * Drives a brief 0→1→0 highlight pulse (for the just-posted Mark). Returns a
 * shared value the card maps to a subtle scale. Reduced motion → stays 0 (no
 * pulse); the DROP entrance alone already draws the eye.
 */
export function useHighlightPulse(active: boolean): SharedValue<number> {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withSpring(1, motionTokens.highlight.spring);
    const t = setTimeout(() => {
      pulse.value = withTiming(0, { duration: motionTokens.highlight.outDuration });
    }, motionTokens.highlight.hold);
    return () => clearTimeout(t);
  }, [active, reduced, pulse]);

  return pulse;
}

/** The distance (px) a card of this mode falls from. */
export function enterDistance(mode: EnterMode): number {
  if (mode === "drop") return motionTokens.drop.distance;
  if (mode === "settle") return motionTokens.settle.distance;
  return 0;
}
