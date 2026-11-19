/**
 * EAS pre-install guard: a malformed EXPO_PUBLIC_SUPABASE_URL makes Expo/Supabase
 * concatenate invalid Auth, REST, and Storage endpoints into a signed binary.
 *
 * Fail closed before install/prebuild. Never print the URL, public key, or
 * arbitrary thrown errors, as EAS logs may be shared with collaborators.
 */
import { validatePublicClientConfig } from './staging-preflight.mjs';

try {
  validatePublicClientConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
  console.log('EAS Supabase public client configuration: valid HTTPS project origin.');
} catch {
  console.error('EAS build blocked: Supabase public client configuration is missing or invalid. EXPO_PUBLIC_SUPABASE_URL must be the HTTPS project origin, without /rest/v1/ or credentials.');
  process.exitCode = 1;
}
