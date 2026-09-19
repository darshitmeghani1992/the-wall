import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("OTP verification exposes resend, cooldown, change-email, and explicit failure states", () => {
  const source = readFileSync("app/(onboarding)/sign-in.tsx", "utf8");
  assert.match(source, /resendCooldown/);
  assert.match(source, /Resend code in/);
  assert.match(source, /Too many attempts/);
  assert.match(source, /code has expired/);
  assert.match(source, /Check your connection/);
  assert.match(source, /Use a different email/);
  assert.match(source, /\^\\d\{6\}\$/);
});

test("Settings exposes account identity and the help-tour route", () => {
  const source = readFileSync("app/settings.tsx", "utf8");
  assert.match(source, /SIGNED IN AS/);
  assert.match(source, /session\?\.user\.email/);
  assert.match(source, /Help and quick tour/);
  assert.match(source, /router\.push\("\/help"\)/);
});

test("the shared icon component uses product vector paths, not unicode placeholders", () => {
  const source = readFileSync("src/components/Icon.tsx", "utf8");
  assert.match(source, /react-native-svg/);
  assert.doesNotMatch(source, /Placeholder monoline icon set|const GLYPH/);
});
