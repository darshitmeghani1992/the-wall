import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, markColors } from "@/theme";
import { Icon, type IconName } from "./Icon";

/**
 * The persistent bottom dock (handoff §Bottom Dock): a black 78px bar with five
 * slots — Home · Walls · ✚ · Discover · Profile. The center ✚ is a raised,
 * tilted yellow FAB that routes to the recipient picker (not a tab). Active tab
 * icons turn brand-yellow and tilt + scale up.
 *
 * Wired as a custom `tabBar` on the expo-router Tabs navigator. The four real
 * tabs are home/walls/discover/profile; ✚ is injected here.
 */
const TAB_ICON: Record<string, IconName> = {
  home: "home",
  walls: "grid",
  discover: "search",
  profile: "person",
};

// Which tab lights up for pushed sub-routes (handoff: Walls active for
// wall/friendWall; Profile active for settings).
export function BottomDock({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();

  const left = state.routes.filter((r) => r.name === "home" || r.name === "walls");
  const right = state.routes.filter(
    (r) => r.name === "discover" || r.name === "profile",
  );

  const renderTab = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
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
            transform: focused
              ? [{ rotate: "-6deg" }, { scale: 1.1 }]
              : undefined,
          }}
        >
          <Icon
            name={icon}
            size={24}
            color={focused ? markColors.brandYellow : "#8a8989"}
          />
        </View>
      </Pressable>
    );
  };

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
      {left.map((r) => renderTab(r.name))}

      {/* A Mark must target another person, so the global action starts with them. */}
      <View style={{ width: 68, alignItems: "center", justifyContent: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave a Mark"
          onPress={() => router.push("/people-picker")}
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

      {right.map((r) => renderTab(r.name))}
    </View>
  );
}
