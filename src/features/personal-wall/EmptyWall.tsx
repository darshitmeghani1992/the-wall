import { View, Pressable } from "react-native";
import { Text } from "@/components/Text";
import { Icon } from "@/components/Icon";
import { Fastener } from "@/components/Fastener";
import { InviteCrew } from "@/components/InviteCrew";
import { colors, radius, shadow, tiltFor } from "@/theme";

/**
 * The honest, anticipatory empty state (AC-1/AC-3). A fresh wall that feels like
 * a page waiting to be filled — never fake fullness. It offers exactly two next
 * actions with a deliberate hierarchy:
 *
 *  - Invite (dominant) — the loud brand-yellow CTA, its own action (never `+`).
 *  - Seed (quiet secondary) — a dedicated one-time "Leave the first note". This
 *    is the ONLY entry to the seed self-Mark; the dock `+` is never wired to it,
 *    so nothing teaches "`+` = post to myself" (Global `+` Contract, D).
 *
 * The ghost placeholders are unmistakably-placeholder empty cards (skeleton
 * bars, reduced opacity) — they suggest "things go here" without faking any real
 * content (AC-1).
 */

/** One faint, clearly-empty placeholder card suggesting "a Mark goes here". */
function GhostMark({ id, lines }: { id: string; lines: number }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          padding: 14,
          opacity: 0.45,
          transform: [{ rotate: `${tiltFor(id)}deg` }],
        },
        shadow.markSeed,
      ]}
    >
      <Fastener kind="tape" />
      <View style={{ gap: 8, marginTop: 4 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <View
            key={i}
            style={{
              height: 9,
              borderRadius: 3,
              width: i === lines - 1 ? "55%" : "100%",
              backgroundColor: colors.surfaceContainerHigh,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function EmptyWall({
  handle,
  displayName,
  hasSeeded,
  onSeed,
}: {
  handle?: string;
  displayName?: string;
  hasSeeded: boolean;
  onSeed: () => void;
}) {
  return (
    <View style={{ marginTop: 12, gap: 26 }}>
      <View style={{ alignItems: "center", gap: 8, paddingHorizontal: 8 }}>
        <Text variant="headline" style={{ textAlign: "center" }}>
          No one&apos;s written on your wall yet
        </Text>
        <Text
          variant="body"
          color={colors.onSurfaceVariant}
          style={{ textAlign: "center" }}
        >
          That&apos;s normal — a wall fills up when the people around you leave
          their mark. Here&apos;s where they&apos;ll land.
        </Text>
      </View>

      {/* Honest ghost placeholders — clearly empty, not fake Marks. */}
      <View
        pointerEvents="none"
        style={{ flexDirection: "row", gap: 14, paddingHorizontal: 6 }}
      >
        <View style={{ flex: 1, paddingTop: 10 }}>
          <GhostMark id="ghost-a" lines={3} />
        </View>
        <View style={{ flex: 1 }}>
          <GhostMark id="ghost-b" lines={2} />
        </View>
      </View>

      {/* Invite — the dominant cold-start action (its own action, the loud yellow). */}
      <InviteCrew handle={handle} displayName={displayName} />

      {/* Seed — the dedicated, quiet, one-time secondary. Distinct from `+`. */}
      {!hasSeeded ? (
        <Pressable
          onPress={onSeed}
          accessibilityRole="button"
          accessibilityLabel="Leave the first note on your own wall"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            alignSelf: "center",
            paddingVertical: 10,
            paddingHorizontal: 16,
          }}
        >
          <Icon name="edit" size={15} color={colors.outline} />
          <Text variant="label" color={colors.outline}>
            Leave the first note
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
