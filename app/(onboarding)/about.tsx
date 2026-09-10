import { Redirect } from "expo-router";
import { LEGACY_ONBOARDING_DESTINATION } from "@/lib/onboarding-contract";

/** Compatibility-only route: the obsolete explanatory carousel is no longer in the happy path. */
export default function LegacyAboutRedirect() {
  return <Redirect href={LEGACY_ONBOARDING_DESTINATION} />;
}
