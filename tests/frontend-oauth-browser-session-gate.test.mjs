import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/lib/auth.tsx", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../app/(onboarding)/sign-in.tsx", import.meta.url), "utf8");
const oauth = source.slice(source.indexOf("async function signInWithOAuth("), source.indexOf("const refreshProfile = useCallback"));

test("OAuth browser cancellation or missing provider URL cannot look like success", () => {
  assert.match(oauth, /if \(!data\?\.url\) throw new Error/);
  assert.match(oauth, /res\.type === "cancel" \|\| res\.type === "dismiss"/);
  assert.match(oauth, /if \(res\.type !== "success" \|\| !res\.url\) \{/);
  assert.ok(!oauth.includes("if (!data?.url) return"));
  assert.ok(!oauth.includes("if (res.type !== \"success\" || !res.url) return"));
});

test("only exact expected redirect and code can be exchanged into a session", () => {
  assert.match(oauth, /const expected = new URL\(redirectTo\)/);
  assert.match(oauth, /url\.protocol !== expected\.protocol/);
  assert.match(oauth, /url\.host !== expected\.host/);
  assert.match(oauth, /url\.pathname !== expected\.pathname/);
  assert.match(oauth, /if \(url\.searchParams\.has\("error"\)\)/);
  assert.match(oauth, /if \(!code\) throw new Error/);
  assert.match(oauth, /const \{ data: exchange, error: exErr \} = await supabase\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(oauth, /if \(exErr\) throw exErr/);
  assert.match(oauth, /if \(!exchange\?\.session\) throw new Error/);
});

test("caller only routes after signInWithOAuth resolves the verified session", () => {
  assert.match(signIn, /await signInWithOAuth\(provider\);\s*router\.replace\("\/"\)/);
  assert.ok(
    oauth.indexOf("if (!exchange?.session)") < oauth.lastIndexOf("}"),
    "missing session is an error rather than a silent native-login success",
  );
});
