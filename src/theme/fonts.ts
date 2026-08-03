/**
 * Font families + a tiered type scale.
 *
 *  - Expression (Bricolage Grotesque): user-generated titles & marks.
 *  - Body UI (Geist): navigation, list rows, metadata.
 *  - Mono (Space Mono): timestamps, "// ACTIVE GAME", attribution "— name".
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
  | "label"; // timestamps, section labels (mono, uppercase)

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
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
};
