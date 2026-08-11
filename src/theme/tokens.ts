/**
 * "The Wall" design system — source of truth for the native app.
 *
 * Ported verbatim from the design handoff (DESIGN.md + developer_handoff_spec.md).
 * Aesthetic: tactile "physical digital" — paper surface, marks that tilt and
 * stack, hard offset shadows simulating pinned paper, tape/push-pin fasteners.
 */

/** Core surfaces + ink (the neutral "paper world"). */
export const colors = {
  surface: "#fbf9f4", // app background (paper)
  surfaceContainer: "#f0eee9", // subtle chips / fills
  surfaceContainerHigh: "#e4e2dd", // dividers, toggle-off track
  surfaceContainerLow: "#f5f3ee",
  card: "#fffdf7", // writer / input paper
  desk: "#e7e4dc", // canvas outside the phone frame (dev only)

  ink: "#0b0c0c", // text, 2px borders, dock, primary buttons
  inkSoft: "#222222", // dark accents / primary-container
  onSurfaceVariant: "#444748", // secondary text
  outline: "#747878", // mono metadata text
  outlineVariant: "#c4c7c7", // dashed / 1px borders

  error: "#ba1a1a",
  onError: "#ffffff",

  white: "#ffffff",
} as const;

/**
 * Mark colors — functional categories. Each mark type maps to a fill (and,
 * for a few, an "on" text color that keeps contrast legible).
 */
export const markColors = {
  stickyYellow: "#ffe14d", // default sticky
  brandYellow: "#f3e300", // FAB, avatar, hero card
  stickyPink: "#ffb3c1",
  neonGreen: "#c6f26b", // sticky variant, "correct" state, toggle-on
  skyBlue: "#a9d8ff",
  roastOrange: "#ff7a3c", // roast marks (always 2px ink border)
  secretPurple: "#5b4b8a", // secret marks (text #f4f1ff)
  secretOnPurple: "#f4f1ff",
  memoryCream: "#f5efe0",
  awardGoldFrom: "#f6e600",
  awardGoldTo: "#c8b400",
} as const;

/** The four color swatches offered in the Sticky writer. */
export const stickySwatches = [
  markColors.stickyYellow,
  markColors.stickyPink,
  markColors.neonGreen,
  markColors.skyBlue,
] as const;

/** 4px base unit. */
export const spacing = {
  unit: 4,
  gutter: 16,
  sideMargin: 20, // screen side margin (margin-safe)
  masonryGap: 14,
  markBottom: 16,
  stackOverlap: -12,
} as const;

/** Hand-cut-paper radii. */
export const radius = {
  sticky: 3,
  card: 5, // cards / buttons / inputs (4–6px)
  tape: 0, // sharp
  pill: 9999,
} as const;

/**
 * Hard offset shadows simulate a physical piece of paper pinned to a wall.
 * The `shadowRadius: 0` (zero blur) offset is the single most ownable move in
 * the whole system — it reads as a real object under raking light, not a
 * Material elevation. Kept sacred; only the *opacity* is raised (from the old
 * near-subliminal 0.12/0.16) so "pinned paper" is felt, not guessed (VD §3).
 *
 * Depth is a ranking language (Principle 2): a real Mark from another person
 * sits on `mark` (top tier); the owner's own seed sits on `markSeed` (middle,
 * quieter — this is how AC-8 reads visually); chrome/CTAs sit on `cta`/`chip`.
 *
 * RN needs iOS (shadow*) + Android (elevation). Android's elevation can't
 * reproduce a zero-blur offset, so the `androidEdge` token below is the
 * first-class, tokenized dual-edge fallback (was an ad-hoc per-component gap,
 * tokens.ts) — components spread it on Android so the signature look degrades
 * gracefully rather than silently vanishing on half the devices.
 */
export const shadow = {
  /** Top tier — a real Mark left by another person. */
  mark: {
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 5,
  },
  /** Middle tier — the owner's own seed Mark (quieter than others' Marks). */
  markSeed: {
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 0,
    elevation: 3,
  },
  /** CTA / hero chrome. */
  cta: {
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 0,
    elevation: 6,
  },
  /** Lowest tier — quiet chips / chrome. */
  chip: {
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 3,
  },
} as const;

/**
 * Android dual-edge fallback (tokenized). A hairline bottom+right edge that
 * approximates the iOS hard-offset shadow on Android, where zero-blur elevation
 * isn't reproducible. Spread onto a card's style behind `Platform.OS ===
 * "android"`. Reversible and additive — never applied on iOS.
 */
export const androidEdge = {
  borderRightWidth: 2,
  borderBottomWidth: 2,
  borderRightColor: "rgba(0,0,0,0.16)",
  borderBottomColor: "rgba(0,0,0,0.16)",
} as const;

export const border = {
  width: 2,
  color: colors.ink,
} as const;

/** Design frame the handoff targets: 390 × 844 logical px iPhone. */
export const frame = {
  width: 390,
  height: 844,
  statusBar: 48,
  dockHeight: 78,
} as const;

/**
 * Tilt discipline (VD §3). A dense wall should read as *casually pinned*, not
 * *chaotic*, so the default range is narrowed to ±`TILT_DEFAULT`°. Loud types
 * (roast) pass a larger `amplitude` to tilt more expressively; chrome/static UI
 * passes 0° (never tilts — a tilted button reads as unstable, not playful).
 */
export const TILT_DEFAULT = 1.75; // narrow, "casually pinned"
export const TILT_LOUD = 3.25; // roast and other loud marks

/**
 * Deterministic tilt for a mark, seeded by its id so a card keeps the *same*
 * rotation across re-renders (never jumps). Returns a value in
 * [-amplitude, +amplitude].
 */
export function tiltFor(seed: string, amplitude: number = TILT_DEFAULT): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = (Math.abs(h) % 1000) / 1000; // 0..1
  return -amplitude + t * (amplitude * 2);
}
