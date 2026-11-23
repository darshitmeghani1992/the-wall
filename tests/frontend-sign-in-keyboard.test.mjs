import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const signIn = readFileSync(new URL("../app/(onboarding)/sign-in.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../src/components/Screen.tsx", import.meta.url), "utf8");

test("sign-in lets its buttons handle taps while the email or OTP input has focus", () => {
  assert.match(signIn, /<Screen\b[^>]*\bkeyboardShouldPersistTaps="handled"/);
  assert.match(screen, /<ScrollView\b[^>]*\bkeyboardShouldPersistTaps=\{keyboardShouldPersistTaps\}/);
});
