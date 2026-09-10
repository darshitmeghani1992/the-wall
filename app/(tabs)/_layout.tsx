import { Tabs } from "expo-router";
import { BottomDock } from "@/components/BottomDock";

/** The approved authenticated navigation: My Wall · Discover · Alerts · Profile. */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomDock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: "My Wall" }} />
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      {/* Kept routable only so old /walls links can redirect to canonical My Wall. */}
      <Tabs.Screen name="walls" options={{ href: null }} />
    </Tabs>
  );
}
