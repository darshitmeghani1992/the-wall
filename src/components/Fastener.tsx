import { View } from "react-native";

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
export function Fastener({ kind }: { kind: "pin" | "tape" }) {
  if (kind === "pin") {
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
          // Approximates radial-gradient(circle at 35% 30%, #ff9a5c, #c2402a).
          backgroundColor: "#d8542f",
          borderTopColor: "#ff9a5c",
          borderTopWidth: 2,
          shadowColor: "#000",
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
