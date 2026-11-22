/**
 * EAS pre-install guard: a malformed EXPO_PUBLIC_SUPABASE_URL makes Expo/Supabase
 * concatenate invalid Auth, REST, and Storage endpoints into a signed binary.
 *
 * Fail closed before install/prebuild. Never print the URL, public key, or
 * arbitrary thrown errors, as EAS logs may be shared with collaborators.
 */
import { assertApprovedStagingOrigin, assertLegacyAnonKeyMatchesOrigin, validatePublicClientConfig } from './staging-preflight.mjs';

try {
  const origin = validatePublicClientConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
  // Hard stop: never package the original production project into any beta build.
  assertApprovedStagingOrigin(origin);
  assertLegacyAnonKeyMatchesOrigin(origin, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  console.log('EAS beta backend: approved staging origin and public client configuration verified.');
} catch {
  console.error('EAS build blocked: Supabase public client configuration is missing, invalid or points to a different project. Beta builds must target the approved staging origin with a matching public key.');
  process.exitCode = 1;
}
