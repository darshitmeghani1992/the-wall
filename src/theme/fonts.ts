/**
 * Font families + a tiered type scale.
 *
 * The system moves toward TWO primary voices (VD-3): an expression face for
 * human content and a clean body/UI face for everything else. The mono face is
 * demoted from "the voice of every label" to a sparse, literal accent.
 *
 *  - Expression (Bricolage Grotesque): user-generated titles & marks.
 *  - Body UI (Geist): navigation, list rows, metadata, AND section/attribution
 *    labels (the `label` variant — warmed off mono, VD-3).
 *  - Mono (Space Mono): RESERVED for sparse literal machine timestamps only
 *    (the `mono` variant), never section labels or attribution.
 *
 * The keys here are the names we register with expo-font in app/_layout.tsx.
 */
export const fontFamily = {
  displayBold: "Bricolage-ExtraBold",
  display: "Bricolage-Bold",
  displaySemi: "Bricolage-SemiBold",
  body: "Geist-Regular",
  bodyMedium: "Geist-Medium",
  bodySemi: "Geist-SemiBold",
  mono: "SpaceMono-Regular",
  monoBold: "SpaceMono-Bold",
} as const;

export type TypeVariant =
  | "display" // screen titles, wordmark
  | "mark" // user-generated mark text
  | "headline" // card titles, buttons
  | "body" // metadata, list rows
  | "label" // section labels / attribution (Geist, uppercase, spaced)
  | "mono"; // sparse literal machine timestamps only

export const type: Record<
  TypeVariant,
  {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing?: number;
    textTransform?: "uppercase" | "none";
  }
> = {
  display: {
    fontFamily: fontFamily.displayBold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6, // ~ -0.02em at 30px
  },
  mark: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 23,
  },
  headline: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    // Warmed off Space-Mono → Geist-SemiBold uppercase (VD-3). Reads as a
    // small hand-label / index-card caption, not a code comment.
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  mono: {
    // Sparse literal timestamps only — the deliberate "machine" counterpoint.
    fontFamily: fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
  },
};
