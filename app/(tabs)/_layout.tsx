import { Tabs } from "expo-router";
import { BottomDock } from "@/components/BottomDock";

/**
 * The four dock tabs: Home · Walls · Discover · Profile. The center ✚ FAB and
 * the black bar itself are drawn by <BottomDock/> (a custom tabBar), which also
 * routes ✚ to the Create modal.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomDock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="walls" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
