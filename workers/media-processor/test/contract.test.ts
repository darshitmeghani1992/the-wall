import assert from "node:assert/strict";
import test from "node:test";
import { completionAuthorization, parseVerifiedDispatchClaims, type WorkerDispatchClaims } from "../src/contract.js";

const NOW = 2_000_000_000;
const JOB = "11111111-1111-4111-8111-111111111111";
const UPLOAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTEMPT = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";

function photoClaims(overrides: Partial<WorkerDispatchClaims> = {}): WorkerDispatchClaims {
  const prefix = `validated/${UPLOAD}/${ATTEMPT}`;
  return {
    version: 1,
    issuer: "the-wall-mark-media-edge",
    audience: "the-wall-media-processor",
    purpose: "dispatch",
    job_id: JOB,
    upload_id: UPLOAD,
    attempt_id: ATTEMPT,
    kind: "photo",
    source: { path: `staging/${USER}/${UPLOAD}/source`, url: `https://project.supabase.co/storage/v1/object/sign/mark-media/staging/${USER}/${UPLOAD}/source?token=x`, method: "GET" },
    destinations: [
      { role: "full_jpeg", path: `${prefix}/full.jpg`, url: `https://project.supabase.co/storage/v1/object/upload/sign/mark-media/${prefix}/full.jpg?token=x`, method: "PUT", mime_type: "image/jpeg", cache_control_seconds: 60 },
      { role: "full_webp", path: `${prefix}/full.webp`, url: `https://project.supabase.co/storage/v1/object/upload/sign/mark-media/${prefix}/full.webp?token=x`, method: "PUT", mime_type: "image/webp", cache_control_seconds: 60 },
    ],
    callback_url: "https://project.supabase.co/functions/v1/mark-media-worker/worker/complete",
    nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    completion_token: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    iat: NOW - 1,
    exp: NOW + 119,
    ...overrides,
  };
}

test("accepts exact protocol-v2 Photo claims", () => {
  assert.deepEqual(parseVerifiedDispatchClaims(photoClaims(), NOW), photoClaims());
});

test("enforces +10 second skew and no grace at expiry", () => {
  assert.doesNotThrow(() => parseVerifiedDispatchClaims(photoClaims({ iat: NOW + 10, exp: NOW + 120 }), NOW));
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ iat: NOW + 11, exp: NOW + 120 }), NOW), /expired/);
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ exp: NOW }), NOW), /expired/);
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ iat: NOW - 1, exp: NOW + 120 }), NOW), /lifetime/);
});

test("rejects unknown payload claims, wrong purpose and noncanonical UUIDs", () => {
  assert.throws(() => parseVerifiedDispatchClaims({ ...photoClaims(), attacker: true }, NOW), /unexpected/);
  assert.throws(() => parseVerifiedDispatchClaims({ ...photoClaims(), purpose: "completion" }, NOW), /identity/);
  assert.throws(() => parseVerifiedDispatchClaims({ ...photoClaims(), upload_id: UPLOAD.toUpperCase() }, NOW), /lowercase/);
});

test("requires distinct exact 32-byte credentials", () => {
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ nonce: "too-short" }), NOW), /credentials/);
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ completion_token: photoClaims().nonce }), NOW), /domain-separated/);
});

test("completion authorization excludes dispatch nonce and signed URLs", () => {
  const authorization = completionAuthorization({ ...photoClaims(), envelopeKid: "current-a" });
  assert.deepEqual(Object.keys(authorization).sort(), ["attemptId", "callbackUrl", "completionToken", "envelopeKid", "uploadId"]);
  assert.equal(JSON.stringify(authorization).includes(photoClaims().nonce), false);
  assert.equal(JSON.stringify(authorization).includes("storage/v1"), false);
});

test("requires exact Photo roles, paths, MIME and cache boundary", () => {
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ destinations: photoClaims().destinations.slice(0, 1) }), NOW), /roles/);
  const duplicate = { ...photoClaims().destinations[1]!, role: "full_jpeg" as const };
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ destinations: [photoClaims().destinations[0]!, duplicate] }), NOW), /roles/);
  const wrongPath = { ...photoClaims().destinations[0]!, path: `validated/${UPLOAD}/${ATTEMPT}/other.jpg` };
  assert.throws(() => parseVerifiedDispatchClaims(photoClaims({ destinations: [wrongPath, photoClaims().destinations[1]!] }), NOW), /path/);
  const wrongCache = { ...photoClaims().destinations[0]!, cache_control_seconds: 3600 };
  assert.throws(() => parseVerifiedDispatchClaims({ ...photoClaims(), destinations: [wrongCache, photoClaims().destinations[1]!] }, NOW), /destination/);
});
