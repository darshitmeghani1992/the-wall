import { View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { inviteFriends } from "@/lib/share";
import { colors, markColors, radius } from "@/theme";

/**
 * Empty-wall first-run state. A wall only comes alive when friends leave Marks,
 * so a brand-new user is nudged to invite their crew before anything else.
 *
 * Uses the shared `inviteFriends` helper (IMPLEMENTED `thewall://` deep link) so
 * we never surface the deferred/unverified HTTPS link to users, and the invite
 * is tracked in the growth funnel.
 */
export function InviteCrew({ handle }: { handle?: string }) {
  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: colors.ink,
        borderStyle: "dashed",
        borderRadius: radius.card,
        padding: 22,
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.surfaceContainerLow,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: markColors.brandYellow,
          borderWidth: 2,
          borderColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "-6deg" }],
        }}
      >
        <Text variant="display" style={{ fontSize: 26 }}>
          ✦
        </Text>
      </View>
      <Text variant="headline" style={{ textAlign: "center" }}>
        Your wall is empty… for now
      </Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
        Walls are written by the people around you. Invite your crew and watch the Marks roll in.
      </Text>
      <View style={{ alignSelf: "stretch", marginTop: 6 }}>
        <Button label="Invite your crew" variant="yellow" onPress={() => inviteFriends(handle)} />
      </View>
    </View>
  );
}
