import { Redirect } from "expo-router";
import { LEGACY_ONBOARDING_DESTINATION } from "@/lib/onboarding-contract";

/** Compatibility-only route: interests are not part of the approved activation setup. */
export default function LegacyInterestsRedirect() {
  return <Redirect href={LEGACY_ONBOARDING_DESTINATION} />;
}
