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
