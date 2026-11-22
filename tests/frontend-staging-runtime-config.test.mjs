import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  APPROVED_BETA_STAGING_ORIGIN,
  selectBetaClientConfig,
} from "../src/lib/config.ts";

const staging = "https://ewintxgdxdvschiqodkq.supabase.co";
const publicKey = "sb_publishable_test_public_only";
const disabled = { url: undefined, key: undefined };

test("Expo client selects only the approved staging Supabase project", () => {
  assert.equal(APPROVED_BETA_STAGING_ORIGIN, staging);
  for (const approvedUrl of [staging, staging + "/"]) {
    assert.deepEqual(selectBetaClientConfig(approvedUrl, publicKey), {
      url: staging,
      key: publicKey,
    });
  }
});

test("client cannot contact production or unapproved URL even without EAS pre-install", () => {
  const refused = [
    "https://wfsfafmgvxevpzrurofz.supabase.co",
    "https://example.supabase.co",
    staging + ".attacker.invalid",
    staging + "/rest/v1",
    staging + "?token=secret",
    staging + "#fragment",
    staging.replace("https:", "http:"),
    "https://user:password@ewintxgdxdvschiqodkq.supabase.co",
    "",
    undefined,
  ];
  for (const candidate of refused) {
    assert.deepEqual(selectBetaClientConfig(candidate, publicKey), disabled);
  }
});

test("runtime refuses missing and obvious modern secret client keys", () => {
  for (const key of [
    undefined,
    "",
    " ",
    "sb_secret_server_only",
    "SB_SECRET_SERVER_ONLY",
    "sb_publishable_with space",
    "\n" + publicKey,
  ]) {
    assert.deepEqual(selectBetaClientConfig(staging, key), disabled);
  }
});

test("Supabase client consumes only the fenced config exports", () => {
  const config = readFileSync(new URL("../src/lib/config.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
  assert.match(config, /export const supabaseUrl = betaConfig\.url/);
  assert.match(config, /export const supabaseAnonKey = betaConfig\.key/);
  assert.match(client, /import \{ supabaseAnonKey, supabaseUrl \} from "\.\/config"/);
  assert.match(client, /createClient\(supabaseUrl \?\? "http:\/\/localhost"/);
  assert.doesNotMatch(client, /process\.env\.EXPO_PUBLIC_SUPABASE_URL/);
});

function mockLegacyKey(claims, signature = "unsigned-test-only") {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    signature,
  ].join(".");
}

test("Expo runtime accepts a staging-matching legacy anon key without Node or browser base64 globals", () => {
  const key = mockLegacyKey({
    role: "anon",
    ref: "ewintxgdxdvschiqodkq",
    note: "Unicode-safe ☀",
  });
  assert.deepEqual(selectBetaClientConfig(staging, key), { url: staging, key });
  // Legacy keys are locally decoded, not verified: the hosted server must still
  // validate their signatures, and signed-device QA is required separately.
  const source = readFileSync(new URL("../src/lib/config.ts", import.meta.url), "utf8");
  assert.equal(source.includes("Buffer.from("), false);
  assert.equal(source.includes("atob("), false);
});

test("Expo runtime rejects opaque, privileged, foreign and malformed keys without EAS", () => {
  const refused = [
    "opaque-unclassified-key",
    "sb_publishable_with space",
    "SB_PUBLISHABLE_case_invalid",
    mockLegacyKey({ role: "service_role", ref: "ewintxgdxdvschiqodkq" }),
    mockLegacyKey({ role: "authenticated", ref: "ewintxgdxdvschiqodkq" }),
    mockLegacyKey({ role: "anon", ref: "wfsfafmgvxevpzrurofz" }),
    mockLegacyKey({ role: "anon", ref: "some-other-project" }),
    mockLegacyKey({ role: "anon" }),
    mockLegacyKey({ role: "anon", ref: null }),
    mockLegacyKey({ role: "anon", ref: "ewintxgdxdvschiqodkq" }, "bad signature"),
    "eyJhbGciOiJIUzI1NiJ9.!!invalid!!.signature",
    "eyJhbGciOiJIUzI1NiJ9.e30.signature",
    "eyJhbGciOiJIUzI1NiJ9.7w.signature",
  ];
  for (const key of refused) {
    assert.deepEqual(selectBetaClientConfig(staging, key), disabled);
  }
});
