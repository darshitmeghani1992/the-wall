import { Redirect } from "expo-router";

/** Compatibility for historical /walls links; selection now lives on My Wall. */
export default function LegacyWallsRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
