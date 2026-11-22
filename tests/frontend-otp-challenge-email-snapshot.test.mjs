import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(onboarding)/sign-in.tsx", import.meta.url), "utf8");

test("an OTP challenge always verifies the exact requested immutable email", () => {
  assert.match(source, /const \[sentEmail, setSentEmail\] = useState<string \| null>\(null\)/);
  assert.match(source, /const sent = sentEmail !== null/);
  assert.match(source, /onPress=\{\(\) => void sendCode\(email\.trim\(\)\)\}/);
  assert.match(source, /await signInWithEmail\(targetEmail\);\s*setSentEmail\(targetEmail\)/);
  assert.match(source, /We sent a 6-digit code to \{sentEmail\}/);
  assert.match(source, /await verifyEmailOtp\(sentEmail, code\.trim\(\)\)/);
  assert.match(source, /await sendCode\(sentEmail\)/);
  assert.match(source, /setSentEmail\(null\)/);
});

test("in-flight OTP and OAuth actions cannot overlap or edit original email", () => {
  assert.match(source, /if \(operationInFlight\.current\) return;/);
  assert.match(source, /if \(!sentEmail \|\| operationInFlight\.current\) return;/);
  assert.match(source, /if \(operationInFlight\.current \|\| resendCooldown > 0 \|\| !sentEmail\) return;/);
  assert.match(source, /operationInFlight\.current = true/);
  assert.match(source, /operationInFlight\.current = false/);
  assert.match(source, /editable=\{!busy\}/);
  assert.match(source, /setCode\(""\);\s*setResendCooldown\(30\)/);
});
