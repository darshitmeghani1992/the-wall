import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/auth/callback.tsx", import.meta.url), "utf8");

test("explicit OAuth denial and malformed codes reject before existing-session fallback", () => {
  assert.match(source, /error: providerError/);
  assert.match(source, /error_code: providerErrorCode/);
  assert.match(source, /error_description: providerErrorDescription/);
  assert.match(source, /const decision = decideAuthCallback\(/);
  assert.match(source, /if \(decision\.kind === "reject"\)/);
  assert.ok(
    source.indexOf('if (decision.kind === "reject")') <
      source.indexOf("await supabase.auth.getSession()"),
    "provider denial must be considered before any existing-session fallback",
  );
  assert.match(source, /\[code, providerError, providerErrorCode, providerErrorDescription, router\]/);
});

test("callback error provides an actionable, accessible path back to sign-in", () => {
  assert.match(source, /accessibilityRole="alert"/);
  assert.match(source, /label="Try signing in again"/);
  assert.match(source, /router\.replace\("\/\(onboarding\)\/sign-in"\)/);
  assert.ok(
    source.indexOf("Try signing in again") > source.indexOf("{error ? ("),
    "retry button must only appear in the callback error state",
  );
});

test("fresh redirect attempts clear old visible errors and retain stale-operation cancellation", () => {
  assert.match(source, /let active = true;\s*setError\(null\)/);
  assert.match(source, /if \(active\) router\.replace\("\/"\)/);
  assert.match(source, /return \(\) => \{\s*active = false/);
});
