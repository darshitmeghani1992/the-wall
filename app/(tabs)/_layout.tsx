import { Tabs } from "expo-router";
import { BottomDock } from "@/components/BottomDock";

/**
 * The dock tabs: Home · Discover · Profile. The `walls` tab was removed —
 * the Personal Wall is now the Home tab (Option C, wall-as-home). The black bar
 * and (this cycle, hidden) center ✚ are drawn by <BottomDock/>, a custom tabBar.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomDock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
