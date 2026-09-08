import { Redirect } from "expo-router";

/** Compatibility for historical /wall links; My Wall now lives at /home. */
export default function LegacyWallRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
