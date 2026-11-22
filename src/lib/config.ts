/** Public client configuration. Secrets must never be added to this module. *
 *
 * The current private-beta train is explicitly STAGING ONLY. EAS pre-install
 * validates configuration before packaging; this runtime fence additionally
 * protects local Expo/Metro and builds launched outside that hook from making
 * Auth/REST/Storage requests to the original production backend.
 */
export const APPROVED_BETA_STAGING_ORIGIN = "https://ewintxgdxdvschiqodkq.supabase.co";

type PublicBetaClientConfig = { url: string | undefined; key: string | undefined };

export function selectBetaClientConfig(
  url: string | undefined,
  key: string | undefined,
): PublicBetaClientConfig {
  // Match only the approved origin with an optional trailing slash. Do not use
  // URL-prefix matching: an attacker suffix and the original project must fail.
  const approvedOrigin =
    url === APPROVED_BETA_STAGING_ORIGIN ||
    url === APPROVED_BETA_STAGING_ORIGIN + "/";
  // EXPO_PUBLIC_ variables are embedded in the bundle. The separate EAS
  // pre-install validator also checks legacy JWT role and project claims.
  const hasSafePublicKey =
    typeof key === "string" &&
    key.length > 0 &&
    !/\s/.test(key) &&
    !/^sb_secret_/i.test(key);
  if (!approvedOrigin || !hasSafePublicKey) {
    // src/lib/supabase.ts uses its existing inert localhost placeholder when
    // unconfigured; the app must not contact an unapproved Supabase project.
    return { url: undefined, key: undefined };
  }
  return { url: APPROVED_BETA_STAGING_ORIGIN, key };
}

const betaConfig = selectBetaClientConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
export const supabaseUrl = betaConfig.url;
export const supabaseAnonKey = betaConfig.key;
