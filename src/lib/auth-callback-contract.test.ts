import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's test runner resolves the explicit source extension.
import { decideAuthCallback } from "./auth-callback-contract.ts";

test("a single valid PKCE code is selected for exchange", () => {
  assert.deepEqual(decideAuthCallback({ code: "pkce-code-123" }), { kind: "exchange", code: "pkce-code-123" });
  assert.deepEqual(decideAuthCallback({}), { kind: "existing_session" });
});

test("provider failure keys always override any existing session or code", () => {
  for (const errorParams of [
    { error: "access_denied" },
    { error: "" },
    { error_code: "provider_cancelled" },
    { error_code: "" },
    { error_description: "Request declined" },
    { error_description: "" },
    { error: ["access_denied", "invalid"] },
  ]) {
    assert.deepEqual(decideAuthCallback({ code: "pkce-code-123", ...errorParams }), { kind: "reject" });
    assert.deepEqual(decideAuthCallback(errorParams), { kind: "reject" });
  }
});

test("malformed or duplicate codes are never reinterpreted as missing code", () => {
  for (const code of ["", " ", " code", "code ", "\ncode", "x".repeat(4097), ["one", "two"], []]) {
    assert.deepEqual(decideAuthCallback({ code }), { kind: "reject" });
  }
  assert.deepEqual(decideAuthCallback({ code: "x".repeat(4096) }), {
    kind: "exchange", code: "x".repeat(4096),
  });
});
