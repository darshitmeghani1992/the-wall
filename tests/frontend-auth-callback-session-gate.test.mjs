import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/auth/callback.tsx", import.meta.url), "utf8");

test("auth callback checks Supabase result errors before reaching the app", () => {
  assert.match(source, /const \{ error: exchangeError \} = await supabase\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(source, /if \(exchangeError\) throw exchangeError/);
  assert.match(source, /if \(active\) router\.replace\("\/"\)/);
  assert.ok(source.indexOf("if (exchangeError) throw exchangeError") < source.indexOf('if (active) router.replace("/")'));
});

test("missing OAuth code never silently navigates without a session", () => {
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
