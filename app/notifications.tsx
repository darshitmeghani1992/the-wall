import { Redirect } from "expo-router";

/** Compatibility for historical /notifications links; Alerts is now a tab. */
export default function LegacyNotificationsRedirect() {
  return <Redirect href="/(tabs)/alerts" />;
}
