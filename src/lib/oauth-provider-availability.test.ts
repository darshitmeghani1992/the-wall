import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
// @ts-ignore Node test runner resolves the explicit source extension.
import { fetchOAuthProviderAvailability, noOAuthProviders, parseOAuthProviderAvailability } from "./oauth-provider-availability.ts";

test("OAuth capability detection and PKCE contract", async () => {
assert.deepEqual(parseOAuthProviderAvailability(null), noOAuthProviders);
assert.deepEqual(parseOAuthProviderAvailability({ external: { google: true, apple: false } }), { google: true, apple: false });
assert.deepEqual(parseOAuthProviderAvailability({ external: { google: "true", apple: 1 } }), noOAuthProviders);
assert.deepEqual(parseOAuthProviderAvailability({ external: { email: true } }), noOAuthProviders);

let fetched = "";
let keySeen = "";
const available = await fetchOAuthProviderAvailability({
  url: "https://example.supabase.co",
  anonKey: "public-test-key",
  fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
    fetched = String(url);
    keySeen = String((options?.headers as Record<string, string>)?.apikey);
    return { ok: true, json: async () => ({ external: { google: true, apple: false } }) } as Response;
  }) as typeof fetch,
});
assert.deepEqual(available, { google: true, apple: false });
assert.equal(fetched, "https://example.supabase.co/auth/v1/settings");
assert.equal(keySeen, "public-test-key");
assert.deepEqual(await fetchOAuthProviderAvailability({ url: "https://example.supabase.co/rest/v1/", anonKey: "key" }), noOAuthProviders);
assert.deepEqual(await fetchOAuthProviderAvailability({ url: "http://example.supabase.co", anonKey: "key" }), noOAuthProviders);
assert.deepEqual(await fetchOAuthProviderAvailability({ url: "https://example.supabase.co", anonKey: "key", fetchImpl: (async () => { throw new Error("network"); }) as unknown as typeof fetch }), noOAuthProviders);
assert.deepEqual(await fetchOAuthProviderAvailability({ url: "https://example.supabase.co", anonKey: "key", fetchImpl: (async () => ({ ok: false })) as unknown as typeof fetch }), noOAuthProviders);

// OAuth's code-exchange contract requires PKCE rather than the default implicit flow.
const supabaseSource = readFileSync("src/lib/supabase.ts", "utf8");
const signInSource = readFileSync("app/(onboarding)/sign-in.tsx", "utf8");
const authSource = readFileSync("src/lib/auth.tsx", "utf8");
assert.match(supabaseSource, /flowType:\s*["']pkce["']/);
assert.match(authSource, /exchangeCodeForSession\(code\)/);
assert.match(signInSource, /oauthProviders\.google\s*&&/);
assert.match(signInSource, /oauthProviders\.apple\s*&&/);

});
