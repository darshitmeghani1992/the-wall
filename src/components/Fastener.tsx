import { View } from "react-native";
import { colors, pinColors } from "@/theme";

/**
 * The "fastener" that pins a mark to the wall. Every memory/roast must have one
 * (handoff §Elevation & Depth). Two kinds:
 *
 *  - "pin": a 14px push-pin circle with a radial highlight + soft drop shadow.
 *  - "tape": a ~60×20px translucent washi-tape strip, sharp corners, slightly
 *    rotated, centered above the card.
 *
 * Rendered at a higher z-index than the card, positioned just above its top edge.
 */
export function Fastener({ kind, seed = "mark" }: { kind: "pin" | "tape"; seed?: string }) {
  if (kind === "pin") {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) | 0;
    }
    const pinColor = pinColors[Math.abs(hash) % pinColors.length];
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -7,
          alignSelf: "center",
          zIndex: 14,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: pinColor,
          borderWidth: 2,
          borderColor: colors.white,
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.35,
          shadowRadius: 2,
          elevation: 6,
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -10,
        alignSelf: "center",
        zIndex: 14,
        width: 60,
        height: 20,
        backgroundColor: "rgba(255,255,255,0.5)",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.12)",
        transform: [{ rotate: "-3deg" }],
      }}
    />
  );
}
