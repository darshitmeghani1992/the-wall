import { View, Share } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { colors } from "@/theme";

/**
 * Open the native share sheet with a personalized, receive-first invite to the
 * user's own wall. Reused wherever "invite" is offered (empty wall + the
 * post-seed re-center) so the share logic lives in exactly one place.
 *
 * Honest by construction (AC-1/AC-4): we can't verify delivery, so there is no
 * "invite sent" state — the sheet opening is the whole action.
 */
export async function shareInvite(handle?: string, displayName?: string) {
  const link = handle ? `https://thewall.app/@${handle}` : "https://thewall.app";
  const who = displayName?.trim();
  const message = who
    ? `${who} started a wall on The Wall — come leave a mark on it: ${link}`
    : `come leave a mark on my wall: ${link}`;
  await Share.share({ message });
}

/**
 * The invite call-to-action. This is the dominant cold-start move on an empty
 * wall (PRD §8, AC-4): a warm, generous "give people a place to say something to
 * you". The loud brand-yellow lives on the CTA button (its one reserved job —
 * the "act on a wall" gesture, VD §3); the badge above it is deliberately
 * neutral so yellow reads unambiguously as "this is how you add to a wall".
 */
export function InviteCrew({
  handle,
  displayName,
}: {
  handle?: string;
  displayName?: string;
}) {
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 4 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="invite" size={26} color={colors.surface} />
      </View>
      <Text variant="headline" style={{ textAlign: "center" }}>
        Invite your crew
      </Text>
      <Text
        variant="body"
        color={colors.onSurfaceVariant}
        style={{ textAlign: "center" }}
      >
        Walls are written by the people around you. Send yours and watch the
        Marks roll in.
      </Text>
      <View style={{ alignSelf: "stretch", marginTop: 2 }}>
        <Button
          label="Invite friends"
          variant="yellow"
          tactile
          onPress={() => shareInvite(handle, displayName)}
        />
      </View>
    </View>
  );
}
