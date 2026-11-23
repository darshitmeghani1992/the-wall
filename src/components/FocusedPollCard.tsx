import { View } from "react-native";
import { Text } from "@/components/Text";
import type { FocusedPoll } from "@/lib/poll-focused-reader";
import { colors, radius } from "@/theme";

export function FocusedPollCard({ poll }: { poll: FocusedPoll }) {
  return (
    <View style={{ gap: 10, padding: 16, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radius.card, backgroundColor: colors.card }}>
      <Text variant="label" color={colors.outline}>
        {poll.state === "closed" ? "Closed Poll" : "Poll"} · {poll.selectionMode === "single" ? "One choice" : "Multiple choices"}
      </Text>
      <Text variant="headline" accessibilityRole="header">{poll.question}</Text>
      <View accessibilityRole="list" accessibilityLabel="Poll options" style={{ gap: 8 }}>
        {poll.options.map((option) => (
          <View key={option.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 }}>
            <Text style={{ flex: 1 }}>{option.label}</Text>
            {option.count === null ? null : <Text color={colors.outline}>{option.count} {option.count === 1 ? "selection" : "selections"}</Text>}
          </View>
        ))}
      </View>
      {poll.ballotTotal === null
        ? <Text color={colors.outline}>Results are unavailable.</Text>
        : <Text color={colors.outline}>{poll.ballotTotal} {poll.ballotTotal === 1 ? "ballot" : "ballots"}</Text>}
    </View>
  );
}
