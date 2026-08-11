/**
 * Motion tokens — the single source of truth for timing, easing, and the DROP
 * geometry. Every animation primitive (MarkCard DROP/SETTLE, Button/MarkCard
 * PRESS, the secret REVEAL) references these values instead of hand-rolling
 * durations, so the app's tap/arrival language stays consistent session to
 * session (Frontend Playbook §7 — structure over instinct).
 *
 * Reduced-motion: `useReducedMotionFlag()` re-exports reanimated's device flag
 * (which itself reads the OS AccessibilityInfo "reduce motion" setting). Every
 * primitive checks it and degrades to a plain fade / instant settle. This is a
 * hard accessibility requirement (FP-001 §5, R7), token-gated here so no
 * primitive can silently forget it.
 */
import { Easing, useReducedMotion } from "react-native-reanimated";

/** Durations in ms. */
export const duration = {
  /** Tap press-in / press-out (the shared PRESS language). */
  pressIn: 90,
  pressOut: 120,
  /** DROP: the fall, then the settle back from overshoot. */
  dropFall: 260,
  dropSettle: 150,
  /** Fade used when reduced-motion is on, or for a card's shadow snapping in. */
  fade: 300,
  shadowSnap: 90,
  /** SETTLE: per-card stagger on a populated wall's first paint. */
  settleStagger: 55,
  settleRise: 240,
  /** REVEAL: secret uncover. */
  reveal: 200,
} as const;

/** Easings — physical, not decorative. */
export const easing = {
  /** General standard ease. */
  standard: Easing.out(Easing.cubic),
  /** The fall: accelerate in like gravity. */
  fall: Easing.in(Easing.quad),
  /** The settle back from overshoot: gentle ease-out. */
  settle: Easing.out(Easing.cubic),
} as const;

/**
 * DROP geometry (px). A Mark falls from `startY` above its resting spot, passes
 * its landing point to `overshoot`, then settles to 0 — the hard offset shadow
 * snapping in on landing. This is THE signature moment (VD-7).
 */
export const drop = {
  startY: -160,
  overshoot: 9,
} as const;

/** SETTLE geometry: cards rise a few px into place on first paint. */
export const settle = {
  riseY: 14,
  /** Cap the stagger so a big wall doesn't take forever to finish landing. */
  maxSteps: 10,
} as const;

/**
 * Reduced-motion flag. Wraps reanimated's `useReducedMotion()` so callers
 * import it from the theme (single source), not from the animation library
 * directly. `true` → the OS "reduce motion" setting is on; degrade every
 * primitive to fade/instant.
 */
export function useReducedMotionFlag(): boolean {
  return useReducedMotion();
}
