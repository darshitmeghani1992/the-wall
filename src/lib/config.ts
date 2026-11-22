/** Public client configuration. Secrets must never be added to this module. *
 *
 * The current private-beta train is explicitly STAGING ONLY. EAS pre-install
 * validates configuration before packaging; this runtime fence additionally
 * protects local Expo/Metro and builds launched outside that hook from making
 * Auth/REST/Storage requests to the original production backend.
 */
export const APPROVED_BETA_STAGING_ORIGIN = "https://ewintxgdxdvschiqodkq.supabase.co";
const APPROVED_BETA_STAGING_REF = "ewintxgdxdvschiqodkq";
const B64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

type PublicBetaClientConfig = { url: string | undefined; key: string | undefined };

/**
 * Decode only the JSON payload needed to reject mismatched legacy JWT keys.
 * This uses no Buffer/atob: neither Node globals nor a native base64 polyfill
 * may be available in Expo/Hermes. It does NOT verify JWT signatures; that
 * remains the hosted Supabase Auth/API boundary's responsibility.
 */
function isApprovedLegacyAnonJwt(key: string): boolean {
  const pieces = key.split(".");
  if (pieces.length !== 3 || pieces.some((piece) => !/^[A-Za-z0-9_-]+$/.test(piece))) return false;
  const payload = pieces[1];
  if (payload.length > 4096 || payload.length % 4 === 1) return false;

  try {
    let bits = 0;
    let remaining = 0;
    let percentEncoded = "";
    for (const character of payload) {
      const sixBits = B64URL_ALPHABET.indexOf(character);
      if (sixBits < 0) return false;
      remaining = (remaining << 6) | sixBits;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        const byte = (remaining >> bits) & 0xff;
        percentEncoded += "%" + byte.toString(16).padStart(2, "0");
        remaining &= (1 << bits) - 1;
      }
    }
    // Reject noncanonical trailing bits; never guess what a malformed key says.
    if (remaining !== 0) return false;
    const claims: unknown = JSON.parse(decodeURIComponent(percentEncoded));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return false;
    const values = claims as Record<string, unknown>;
    return values.role === "anon" && values.ref === APPROVED_BETA_STAGING_REF;
  } catch {
    return false;
  }
}

function isApprovedPublicKey(key: string | undefined): key is string {
  if (typeof key !== "string" || key.length === 0 || /\s/.test(key)) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // No opaque, service-role, missing-ref, or other-project JWT credentials.
  return isApprovedLegacyAnonJwt(key);
}

export function selectBetaClientConfig(
  url: string | undefined,
  key: string | undefined,
): PublicBetaClientConfig {
  // Match only the approved origin with an optional trailing slash. Do not use
  // URL-prefix matching: an attacker suffix and the original project must fail.
  const approvedOrigin =
    url === APPROVED_BETA_STAGING_ORIGIN ||
    url === APPROVED_BETA_STAGING_ORIGIN + "/";
  // EXPO_PUBLIC_ variables are embedded in the bundle. EAS independently
  // validates the legacy JWT ref/role before build and probes the hosted API.
  if (!approvedOrigin || !isApprovedPublicKey(key)) {
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
