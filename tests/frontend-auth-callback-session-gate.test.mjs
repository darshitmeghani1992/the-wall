import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/auth/callback.tsx", import.meta.url), "utf8");

test("auth callback requires an actual exchanged session, not only an absent error", () => {
  assert.match(source, /const decision = decideAuthCallback\(/);
  assert.match(source, /const \{ data: exchanged, error: exchangeError \} =\s*await supabase\.auth\.exchangeCodeForSession\(decision\.code\)/);
  assert.match(source, /if \(exchangeError\) throw exchangeError/);
  assert.match(source, /if \(!exchanged\?\.session\) throw new Error/);
  assert.match(source, /if \(active\) router\.replace\("\/"\)/);
  assert.ok(source.indexOf("if (!exchanged?.session)") < source.indexOf('if (active) router.replace("/")'));
});

test("missing OAuth code only navigates with an already verified session", () => {
  assert.match(source, /const \{ data, error: sessionError \} = await supabase\.auth\.getSession\(\)/);
  assert.match(source, /if \(sessionError\) throw sessionError/);
  assert.match(source, /if \(!data\.session\) throw new Error/);
});

test("unmounted callback cannot navigate or report a stale error", () => {
  assert.match(source, /let active = true/);
  assert.match(source, /if \(active\) router\.replace\("\/"\)/);
  assert.match(source, /if \(active\) \{\s*setError/);
  assert.match(source, /return \(\) => \{\s*active = false/);
});
