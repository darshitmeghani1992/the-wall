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
  // No preview can advertise unverified privacy-sensitive features because an
  // old EAS environment happened to retain one of these public flags.
  // Client-side flags are NOT security boundaries; server gates still apply.
  const held = [
    'EXPO_PUBLIC_MEDIA_MARKS_ENABLED',
    'EXPO_PUBLIC_SECRET_MARKS_ENABLED',
    'EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED',
  ];
  if (held.some((flag) => process.env[flag] === 'true')) {
    throw new Error('Unapproved high-risk beta feature flag');
  }
  console.log('EAS beta backend: approved staging origin and public client configuration verified.');
} catch {
  console.error('EAS build blocked: Supabase public client config or high-risk beta feature flags are invalid. Use only approved staging credentials with media, Secret and deletion OFF.');
  process.exitCode = 1;
}
