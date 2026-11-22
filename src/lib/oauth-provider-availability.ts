/** Only enabled identity providers should be displayed at the sign-in boundary. */
export type OAuthProviderAvailability = Readonly<{ google: boolean; apple: boolean }>;

export const noOAuthProviders: OAuthProviderAvailability = Object.freeze({ google: false, apple: false });

export function parseOAuthProviderAvailability(input: unknown): OAuthProviderAvailability {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    !("external" in input) || !input.external || typeof input.external !== "object" ||
    Array.isArray(input.external)) return noOAuthProviders;
  const providers = input.external as Record<string, unknown>;
  return {
    google: providers.google === true,
    apple: providers.apple === true,
  };
}

/**
 * Supabase Auth exposes provider availability via a public settings endpoint.
 * Fail closed on stale/missing configuration, errors, or failed requests:
 * a sign-in button must not promise an unavailable provider.
 * This request uses only the publishable/anon key; never a privileged secret.
 */
export async function fetchOAuthProviderAvailability(
  options: Readonly<{
    url?: string;
    anonKey?: string;
    fetchImpl?: typeof fetch;
  }> = {},
): Promise<OAuthProviderAvailability> {
  const url = options.url;
  const key = options.anonKey;
  if (!url || !key) return noOAuthProviders;
  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search ||
      parsed.hash || parsed.pathname !== "/") return noOAuthProviders;
    origin = parsed.origin;
  } catch {
    return noOAuthProviders;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${origin}/auth/v1/settings`, {
      method: "GET",
      // Do not forward even a public app key to an unapproved redirect host,
      // or trust OAuth-provider availability from a redirected response.
      redirect: "error",
      headers: { apikey: key },
      signal: controller.signal,
    });
    if (!response.ok) return noOAuthProviders;
    const payload: unknown = await response.json();
    return parseOAuthProviderAvailability(payload);
  } catch {
    return noOAuthProviders;
  } finally {
    clearTimeout(timeout);
  }
}
