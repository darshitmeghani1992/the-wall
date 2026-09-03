import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { processEnvelope, type ProcessorDependencies } from "../src/server.js";
import type { WorkerDispatchClaims } from "../src/contract.js";
import { runTool } from "../src/photo.js";

const claims: WorkerDispatchClaims = {
  version: 1,
  issuer: "the-wall-mark-media-edge",
  audience: "the-wall-media-processor",
  purpose: "dispatch",
  job_id: "11111111-1111-4111-8111-111111111111",
  upload_id: "22222222-2222-4222-8222-222222222222",
  attempt_id: "33333333-3333-4333-8333-333333333333",
  kind: "voice",
  source: { path: "staging/44444444-4444-4444-8444-444444444444/22222222-2222-4222-8222-222222222222/source", url: "https://project.supabase.co/storage/v1/object/sign/mark-media/staging/44444444-4444-4444-8444-444444444444/22222222-2222-4222-8222-222222222222/source?token=secret", method: "GET" },
  destinations: [{ role: "full", path: "validated/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/full.m4a", url: "https://project.supabase.co/storage/v1/object/upload/sign/mark-media/validated/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/full.m4a?token=secret", method: "PUT", mime_type: "audio/mp4", cache_control_seconds: 60 }],
  callback_url: "https://project.supabase.co/functions/v1/mark-media-worker/worker/complete",
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  completion_token: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  iat: 1_999_999_999,
  exp: 2_000_000_100,
};

function dependencies(overrides: Partial<ProcessorDependencies> = {}): ProcessorDependencies {
  return {
    verifier: { verify: async () => ({ ...claims, envelopeKid: "key-1" }) },
    nonceRedeemer: { redeem: async () => false },
    completionReporter: { complete: async () => undefined, fail: async () => undefined },
    urlPolicy: { storageHostname: "project.supabase.co", callbackOrigin: "https://project.supabase.co", callbackPath: "/functions/v1/mark-media-worker/worker/complete" },
    now: () => 2_000_000_000_000,
    resolveHostname: async () => undefined,
    ...overrides,
  };
}

test("signature verification runs before nonce redemption and network fetch", async () => {
  const order: string[] = [];
  const fetchImpl = (async () => { order.push("fetch"); throw new Error("unexpected fetch"); }) as typeof fetch;
  await assert.rejects(processEnvelope("opaque", dependencies({
    verifier: { verify: async () => { order.push("verify"); return { ...claims, envelopeKid: "key-1" }; } },
    nonceRedeemer: { redeem: async () => { order.push("redeem"); return false; } },
    fetchImpl,
  })));
  assert.deepEqual(order, ["verify", "redeem"]);
});

test("a replayed dispatch never spends the separate completion credential", async () => {
  let reports = 0;
  await assert.rejects(processEnvelope("replayed", dependencies({
    nonceRedeemer: { redeem: async () => false },
    completionReporter: { complete: async () => { reports++; }, fail: async () => { reports++; } },
  })));
  assert.equal(reports, 0);
});

test("verified but wrong callback or adjacent object URL fails before redemption", async () => {
  for (const changed of [
    { ...claims, callback_url: "https://project.supabase.co/functions/v1/mark-media-worker/worker/fail" },
    { ...claims, source: { ...claims.source, url: "https://project.supabase.co/storage/v1/object/sign/mark-media/staging/44444444-4444-4444-8444-444444444444/99999999-9999-4999-8999-999999999999/source?token=secret" } },
  ]) {
    let redeemed = 0;
    let reported = 0;
    await assert.rejects(processEnvelope("signed", dependencies({
      verifier: { verify: async () => ({ ...changed, envelopeKid: "key-1" }) },
      nonceRedeemer: { redeem: async () => { redeemed++; return true; } },
      completionReporter: { complete: async () => { reported++; }, fail: async () => { reported++; } },
    })));
    assert.equal(redeemed, 0);
    assert.equal(reported, 0);
  }
});

test("lost completion response never changes the consumed token to a failure outcome", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-server-test-"));
  try {
    const source = join(directory, "voice.wav");
    await runTool("ffmpeg", ["-f", "lavfi", "-i", "sine=duration=0.2", "-y", source], 5_000);
    const bytes = await readFile(source);
    let fetches = 0;
    let completions = 0;
    let failures = 0;
    const fetchImpl = (async () => {
      fetches += 1;
      return fetches === 1
        ? new Response(bytes, { status: 200, headers: { "content-length": String(bytes.byteLength) } })
        : new Response(null, { status: 200 });
    }) as typeof fetch;
    await assert.rejects(processEnvelope("signed", dependencies({
      nonceRedeemer: { redeem: async () => true },
      fetchImpl,
      completionReporter: {
        complete: async () => { completions += 1; throw new Error("lost 204"); },
        fail: async () => { failures += 1; },
      },
    })));
    assert.equal(completions, 1);
    assert.equal(failures, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("one attempt deadline aborts a never-settling source fetch", async () => {
  let observedSignal: AbortSignal | undefined;
  const fetchImpl = ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    observedSignal = init?.signal ?? undefined;
    if (!observedSignal) return;
    observedSignal.addEventListener("abort", () => reject(observedSignal?.reason), { once: true });
  })) as typeof fetch;
  const started = Date.now();
  await assert.rejects(processEnvelope("signed", dependencies({
    nonceRedeemer: { redeem: async () => true },
    fetchImpl,
    testOnlyAttemptTimeoutMs: 25,
  })), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes("token=secret"), false);
    return true;
  });
  assert.ok(observedSignal, "Storage fetch receives an AbortSignal");
  assert.equal(observedSignal.aborted, true);
  assert.ok(Date.now() - started < 1_000, "deadline must terminate the hanging fetch promptly");
});

test("unverified claims never reach redemption, callback, logs or network", async () => {
  let sideEffects = 0;
  await assert.rejects(processEnvelope("forged", dependencies({
    verifier: { verify: async () => { throw new Error("forged"); } },
    nonceRedeemer: { redeem: async () => { sideEffects++; return true; } },
    completionReporter: { complete: async () => { sideEffects++; }, fail: async () => { sideEffects++; } },
    fetchImpl: (async () => { sideEffects++; return new Response(); }) as typeof fetch,
    logger: { info: () => { sideEffects++; }, error: () => { sideEffects++; } },
  })));
  assert.equal(sideEffects, 0);
});
