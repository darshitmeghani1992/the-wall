import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, Ed25519EnvelopeVerifier, encodeBase64Url, type WorkerDispatchClaims, type WorkerObjectTarget } from "../src/contract.js";
import { createGatewayAdapters } from "../src/gateway.js";
import { runTool } from "../src/photo.js";
import { createWorkerIngressServer } from "../src/runtime.js";
import { processEnvelope } from "../src/server.js";

// Disposable fixture only: real HTTP ingress, Ed25519, FFmpeg and gateway
// serialization. All Supabase/DNS traffic is substituted in process; never
// use a real signing key, gateway credential, hosted project or user media.
const origin = "https://fixture.supabase.co";
const upload = "22222222-2222-4222-8222-222222222222";
const attempt = "33333333-3333-4333-8333-333333333333";
const sourcePath = "staging/44444444-4444-4444-8444-444444444444/" + upload + "/source";
const prefix = "validated/" + upload + "/" + attempt + "/";
const gatewayPath = origin + "/functions/v1/mark-media-worker/worker/";
const gatewaySecret = "fixture-only-".repeat(4);

function target(role: WorkerObjectTarget["role"], file: string, mime: string): WorkerObjectTarget {
  const path = prefix + file;
  return { role, path, url: origin + "/storage/v1/object/upload/sign/mark-media/" + path + "?token=fixture", method: "PUT", mime_type: mime, cache_control_seconds: 60 };
}

for (const kind of ["photo", "voice", "video"] as const) {
  test("signed HTTP dispatch through real " + kind + " processing and C2 completion receipt", { timeout: 45_000 }, async () => {
    const workspace = await mkdtemp(join(tmpdir(), "signed-media-roundtrip-"));
    const key = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const verifier = await Ed25519EnvelopeVerifier.create([{ kid: "fixture", publicKey: new Uint8Array(await webcrypto.subtle.exportKey("raw", key.publicKey)) }]);
    const destinations = kind === "photo"
      ? [target("full_jpeg", "full.jpg", "image/jpeg"), target("full_webp", "full.webp", "image/webp"), target("preview", "thumb.webp", "image/webp")]
      : kind === "voice" ? [target("full", "full.m4a", "audio/mp4")]
      : [target("full", "full.mp4", "video/mp4"), target("preview", "poster.webp", "image/webp")];
    const now = Math.floor(Date.now() / 1000);
    const claims: WorkerDispatchClaims = {
      version: 1, issuer: "the-wall-mark-media-edge", audience: "the-wall-media-processor", purpose: "dispatch",
      job_id: "11111111-1111-4111-8111-111111111111", upload_id: upload, attempt_id: attempt, kind,
      source: { path: sourcePath, url: origin + "/storage/v1/object/sign/mark-media/" + sourcePath + "?token=fixture", method: "GET" },
      destinations, callback_url: gatewayPath + "complete",
      nonce: Buffer.alloc(32, 1).toString("base64url"), completion_token: Buffer.alloc(32, 2).toString("base64url"), iat: now, exp: now + 120,
    };
    const head = encodeBase64Url(Buffer.from(canonicalJson({ alg: "EdDSA", kid: "fixture", typ: "TW-MEDIA-DISPATCH+jws" })));
    const body = encodeBase64Url(Buffer.from(canonicalJson(claims)));
    const signature = new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.privateKey, Buffer.from(head + "." + body)));
    const compact = head + "." + body + "." + encodeBase64Url(signature);
    const invalidSignature = signature.slice();
    invalidSignature[0] = invalidSignature[0]! ^ 1;
    const forged = head + "." + body + "." + encodeBase64Url(invalidSignature);
    const order: string[] = [];
    const objects = new Map<string, Buffer>();
    let source: Buffer;
    let redeemed = false;
    let receipt: Record<string, unknown> | undefined;
    let completed!: () => void;
    let rejected!: (error: unknown) => void;
    const finished = new Promise<void>((resolve, reject) => { completed = resolve; rejected = reject; });
    // Attach a rejection observer before posting, so an early failure cannot
    // surface as an unhandled rejection while awaiting the HTTP response.
    void finished.catch(() => undefined);
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      assert.equal(init?.redirect, "error");
      if (url === gatewayPath + "redeem") {
        order.push("redeem");
        assert.equal(init?.method, "POST");
        assert.equal(headers.get("authorization"), "Bearer " + gatewaySecret);
        assert.equal(headers.get("x-the-wall-job-token"), compact);
        if (redeemed) return new Response(null, { status: 409 });
        redeemed = true;
        return new Response(null, { status: 204 });
      }
      if (url === claims.source.url) {
        assert.equal(redeemed, true);
        assert.equal(init?.method, "GET");
        order.push("download");
        return new Response(new Uint8Array(source), { status: 200, headers: { "content-length": String(source.length), "content-encoding": "identity" } });
      }
      const destination = destinations.find(item => item.url === url);
      if (destination) {
        order.push("upload");
        assert.equal(init?.method, "PUT");
        assert.equal(headers.get("content-type"), destination.mime_type);
        assert.equal(headers.get("x-upsert"), "false");
        assert.ok(Buffer.isBuffer(init?.body));
        objects.set(destination.path, Buffer.from(init.body));
        return new Response(null, { status: 200 });
      }
      if (url === gatewayPath + "complete") {
        order.push("complete");
        assert.equal(init?.method, "POST");
        assert.equal(headers.get("authorization"), "Bearer " + gatewaySecret);
        assert.equal(headers.get("x-the-wall-job-token"), claims.completion_token);
        receipt = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(null, { status: 204 });
      }
      assert.fail("unexpected fixture request");
    };
    const gateway = createGatewayAdapters({ projectUrl: origin, gatewaySecret, fetchImpl: fakeFetch });
    const server = createWorkerIngressServer({
      verifier,
      process: async (envelope) => {
        try {
          await processEnvelope(envelope, { ...gateway, verifier, fetchImpl: fakeFetch, resolveHostname: async () => undefined });
          completed();
        } catch (error) { rejected(error); throw error; }
      },
    });
    try {
      const input = join(workspace, kind === "photo" ? "photo.png" : kind === "voice" ? "voice.wav" : "video.mp4");
      const args = kind === "photo"
        ? ["-f", "lavfi", "-i", "color=c=red:s=64x32", "-frames:v", "1"]
        : kind === "voice" ? ["-f", "lavfi", "-i", "sine=duration=1"]
        : ["-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=1", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac"];
      await runTool("ffmpeg", [...args, "-y", input], 15_000);
      source = await readFile(input);
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
      const endpoint = "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/v1/media-jobs";
      const send = (envelope: string) => fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/jose" }, body: envelope });
      assert.equal((await send(forged)).status, 404);
      assert.deepEqual(order, [], "forged signature cannot reach C2 or Storage");
      const accepted = await send(compact);
      assert.equal(accepted.status, 202);
      assert.equal(await accepted.text(), "");
      await finished;
      assert.deepEqual(order, ["redeem", "download", "upload", ...(kind === "voice" ? [] : ["upload"]), "complete"]);
      assert.ok(receipt);
      assert.equal(receipt.upload_id, upload);
      assert.equal(receipt.attempt_id, attempt);
      assert.equal(receipt.kid, "fixture");
      const result = receipt.result as Record<string, unknown>;
      const full = objects.get(String(result.validated_path));
      assert.ok(full && full.length > 0);
      assert.equal(result.sha256, createHash("sha256").update(full).digest("hex"));
      assert.equal(result.validated_bytes, full.length);
      assert.equal(result.cache_control_seconds, 60);
      assert.equal(result.detected_mime, destinations.find(item => item.path === result.validated_path)?.mime_type);
      if (kind === "voice") assert.equal(result.preview_path, null);
      else assert.ok(objects.has(String(result.preview_path)));
    } finally {
      server.closeAllConnections();
      if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(workspace, { recursive: true, force: true });
    }
  });
}
