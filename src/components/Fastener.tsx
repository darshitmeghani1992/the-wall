import { View } from "react-native";

/**
 * The one fastener motif (VD-5: reduce to a single excellent, recognizable
 * fastener rather than several mediocre ones). A short strip of translucent
 * washi tape with sharp corners, a faint two-tone body, and — critically — a
 * real *contact shadow* beneath it so it reads as a physical thing pressed onto
 * paper, not a flat grey box.
 *
 * A fastener is a signal, not wallpaper (VD §3): only the higher-emotion Mark
 * types get one (see `chromeFor` in MarkView). The `kind` prop is retained for
 * API stability with existing call sites, but both values now render the single
 * tape motif — the weaker second (pin) motif is retired.
 */
export function Fastener({ kind }: { kind?: "pin" | "tape" }) {
  // `kind` retained for call-site API stability; intentionally not branched on.
  void kind;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -11,
        alignSelf: "center",
        zIndex: 14,
        transform: [{ rotate: "-3.5deg" }],
        // The contact shadow — soft, short-offset — sells "stuck to the wall".
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.22,
        shadowRadius: 2.5,
        elevation: 6,
      }}
    >
      <View
        style={{
          width: 62,
          height: 22,
          backgroundColor: "rgba(247,241,224,0.72)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.65)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {/* A faint darker seam down the middle gives the tape a two-tone body. */}
        <View
          style={{
            position: "absolute",
            left: "48%",
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: "rgba(11,12,12,0.05)",
          }}
        />
      </View>
    </View>
  );
}
