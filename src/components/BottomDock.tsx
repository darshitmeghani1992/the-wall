import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, markColors, type } from "@/theme";
import { Icon, type IconName } from "./Icon";

/**
 * The approved persistent dock. Mark creation is contextual to an eligible
 * Person or Shared Wall, so this navigation deliberately has no global + action.
 */
const TAB_ICON: Record<string, IconName> = {
  home: "home",
  discover: "search",
  alerts: "bell",
  profile: "person",
};

const TAB_LABEL: Record<string, string> = {
  home: "My Wall",
  discover: "Discover",
  alerts: "Alerts",
  profile: "Profile",
};

const TAB_ORDER = ["home", "discover", "alerts", "profile"] as const;

export function BottomDock({ state, navigation }: BottomTabBarProps) {
  const renderTab = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    if (index < 0) return null;
    const focused = state.index === index;
    const icon = TAB_ICON[routeName] ?? "home";
    const label = TAB_LABEL[routeName] ?? routeName;

    return (
      <Pressable
        key={routeName}
        accessibilityRole="tab"
        accessibilityLabel={label}
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
        style={{ flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 }}
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
        <Text
          style={[
            type.label,
            {
              color: focused ? markColors.brandYellow : colors.outlineVariant,
              fontSize: 10,
              lineHeight: 12,
            },
          ]}
        >
          {label}
        </Text>
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
      {TAB_ORDER.map(renderTab)}
    </View>
  );
}
