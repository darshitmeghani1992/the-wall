import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("iPhone tester signing profile targets isolated staging and a store IPA, never simulator or production channel", () => {
  const eas = json("../eas.json");
  const profile = eas.build["ios-staging-testflight"];
  assert.ok(profile, "dedicated profile required for later authorized signed iPhone QA");
  assert.equal(profile.distribution, "store", "TestFlight uses a signed store-distribution IPA");
  assert.equal(profile.environment, "preview", "staging validation vars are in preview, not production");
  assert.equal(profile.channel, "ios-staging-testflight");
  assert.equal(profile.ios.simulator, false);
  assert.equal(eas.submit?.["ios-staging-testflight"], undefined, "no automatic App Store submission");
  assert.equal(profile.autoSubmit, undefined);
  assert.deepEqual(Object.keys(profile).sort(), ["channel", "distribution", "environment", "ios"]);
});

test("staging TestFlight packaging is still blocked on exact backend and disabled high-risk flags", () => {
  const scripts = json("../package.json").scripts;
  assert.equal(scripts["eas-build-pre-install"], "node scripts/validate-eas-backend.mjs");
  const guard = readFileSync(new URL("../scripts/validate-eas-backend.mjs", import.meta.url), "utf8");
  assert.match(guard, /assertApprovedStagingOrigin\(origin\)/);
  assert.match(guard, /assertLegacyAnonKeyMatchesOrigin\(origin,/);
  for (const held of ["EXPO_PUBLIC_MEDIA_MARKS_ENABLED", "EXPO_PUBLIC_SECRET_MARKS_ENABLED", "EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED"]) {
    assert.ok(guard.includes(held), `held flag ${held} must be rejected at build time`);
  }
  const app = json("../app.json");
  assert.equal(app.expo.ios.bundleIdentifier, "com.thewall.app");
  assert.equal(app.expo.extra?.supabaseUrl, "", "no hardcoded public endpoint");
  assert.equal(app.expo.extra?.supabaseAnonKey, "", "no public key embedded in app.json");
});
