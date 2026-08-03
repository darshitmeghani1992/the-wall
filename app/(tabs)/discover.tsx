import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { colors } from "@/theme";

/** Discover — trending walls + search. Built out in Phase 4. */
export default function DiscoverScreen() {
  return (
    <Screen>
      <Text variant="display" style={{ marginVertical: 20 }}>
        Discover
      </Text>
      <Text variant="body" color={colors.onSurfaceVariant}>
        Trending Walls and search arrive in Phase 4.
      </Text>
    </Screen>
  );
}
