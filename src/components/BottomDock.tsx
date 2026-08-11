import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, markColors } from "@/theme";
import { Icon, type IconName } from "./Icon";

/**
 * The persistent bottom dock: a black 78px bar. Tabs are Home · Discover ·
 * Profile (the `walls` tab was folded into Home — wall-as-home, Option C).
 *
 * The center ✚ FAB is HIDDEN this cycle (see `SHOW_DOCK_FAB`) per the Global `+`
 * Navigation Contract (FP-001 §8 / ADR-FP-B). `+` has ONE meaning everywhere —
 * "Leave a Mark (for someone)" — whose real target (an eligible-recipient
 * picker → the recipient's wall) is not buildable this cycle. So on the owner's
 * own wall (the only wall surface that exists), the `+` has no valid in-scope
 * action and is hidden rather than wired to self-post (which would teach
 * "`+` = post to myself", violating the contract). The seed is reached via its
 * own dedicated EmptyWall CTA, never this `+`; Invite is its own dominant CTA.
 *
 * The FAB's press handler is preserved as a SINGLE INDIRECTION POINT (§8A) so
 * the future recipient picker slots into exactly this one handler with no
 * structural rework: flip `SHOW_DOCK_FAB` back on and repoint `onLeaveMark` at
 * the recipient picker (NOT `/create` — that self-targets and must never be the
 * `+`'s meaning). Fully reversible (a single render-gate).
 */
const SHOW_DOCK_FAB = false;

const TAB_ICON: Record<string, IconName> = {
  home: "home",
  discover: "search",
  profile: "person",
};

export function BottomDock({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();

  /**
   * The single `+` indirection point (hidden this cycle). When the future
   * recipient picker ships, repoint this at it — "Who do you want to leave a
   * Mark for?" → composer → the Mark lands on THAT person's wall. It must never
   * self-target. Referenced only inside the `SHOW_DOCK_FAB` block below.
   */
  const onLeaveMark = () => router.push("/create");

  const renderTab = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    if (index < 0) return null;
    const focused = state.index === index;
    const icon = TAB_ICON[routeName] ?? "home";

    return (
      <Pressable
        key={routeName}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: state.routes[index].key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(routeName);
          }
        }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            transform: focused ? [{ rotate: "-6deg" }, { scale: 1.1 }] : undefined,
          }}
        >
          <Icon
            name={icon}
            size={24}
            // Active tab is paper-white, not brandYellow — yellow is reserved
            // for the "act on a wall" gesture (Invite), not nav chrome (VD §3).
            color={focused ? colors.surface : "#8a8989"}
          />
        </View>
      </Pressable>
    );
  };

  // Tab order for an even layout (walls removed).
  const tabOrder = ["home", "discover", "profile"].filter((name) =>
    state.routes.some((r) => r.name === name),
  );

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 78,
        backgroundColor: colors.ink,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingBottom: 14,
      }}
    >
      {SHOW_DOCK_FAB ? (
        <>
          {tabOrder.slice(0, 1).map(renderTab)}
          {/* Center ✚ FAB — the raised/tilted character is preserved in code
              behind the render-gate; the future recipient picker occupies
              `onLeaveMark`. Never rendered this cycle. */}
          <View style={{ width: 68, alignItems: "center", justifyContent: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave a Mark"
              onPress={onLeaveMark}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: markColors.brandYellow,
                borderWidth: 3,
                borderColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ rotate: "-6deg" }],
                marginTop: -18,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 8,
              }}
            >
              <Icon name="plus" size={26} color={colors.ink} />
            </Pressable>
          </View>
          {tabOrder.slice(1).map(renderTab)}
        </>
      ) : (
        // FAB hidden this cycle → an even tab layout, no raised center button.
        tabOrder.map(renderTab)
      )}
    </View>
  );
}
