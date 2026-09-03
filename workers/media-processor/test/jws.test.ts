import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";
import { canonicalJson, Ed25519EnvelopeVerifier, encodeBase64Url } from "../src/contract.js";

const PUBLIC_KEY = Buffer.from("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "hex");
const PRIVATE_SEED = Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex");
const PROTECTED = "eyJhbGciOiJFZERTQSIsImtpZCI6InRlc3QtYSIsInR5cCI6IlRXLU1FRElBLURJU1BBVENIK2p3cyJ9";
const PAYLOAD = "eyJhdHRlbXB0X2lkIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAzIiwiYXVkaWVuY2UiOiJ0aGUtd2FsbC1tZWRpYS1wcm9jZXNzb3IiLCJjYWxsYmFja191cmwiOiJodHRwczovL3Auc3VwYWJhc2UuY28vZnVuY3Rpb25zL3YxL21hcmstbWVkaWEtd29ya2VyL3dvcmtlci9jb21wbGV0ZSIsImNvbXBsZXRpb25fdG9rZW4iOiJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCIiwiZGVzdGluYXRpb25zIjpbeyJjYWNoZV9jb250cm9sX3NlY29uZHMiOjYwLCJtZXRob2QiOiJQVVQiLCJtaW1lX3R5cGUiOiJhdWRpby9tcDQiLCJwYXRoIjoidmFsaWRhdGVkLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMi8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDMvZnVsbC5tNGEiLCJyb2xlIjoiZnVsbCIsInVybCI6Imh0dHBzOi8vcC5zdXBhYmFzZS5jby9zdG9yYWdlL3YxL29iamVjdC91cGxvYWQvc2lnbi9tYXJrLW1lZGlhL3ZhbGlkYXRlZC8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDIvMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAzL2Z1bGwubTRhP3Rva2VuPWRzdCJ9XSwiZXhwIjoxNzg4NDA4MTIwLCJpYXQiOjE3ODg0MDgwMDAsImlzc3VlciI6InRoZS13YWxsLW1hcmstbWVkaWEtZWRnZSIsImpvYl9pZCI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsImtpbmQiOiJ2b2ljZSIsIm5vbmNlIjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQSIsInB1cnBvc2UiOiJkaXNwYXRjaCIsInNvdXJjZSI6eyJtZXRob2QiOiJHRVQiLCJwYXRoIjoic3RhZ2luZy8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDQvMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAyL3NvdXJjZSIsInVybCI6Imh0dHBzOi8vcC5zdXBhYmFzZS5jby9zdG9yYWdlL3YxL29iamVjdC9zaWduL21hcmstbWVkaWEvc3RhZ2luZy8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDQvMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAyL3NvdXJjZT90b2tlbj1zcmMifSwidXBsb2FkX2lkIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAyIiwidmVyc2lvbiI6MX0";
const SIGNATURE = "oG7jrzajNltxT6q4AeUSmRXT1zFYnZRel8HD6mQY4DK_MNKDT1Q6cZHNPCpBFXY1q6yAKs3uWqyEh--8SS--DQ";
const VECTOR = `${PROTECTED}.${PAYLOAD}.${SIGNATURE}`;

async function verifier() {
  return await Ed25519EnvelopeVerifier.create([{ kid: "test-a", publicKey: PUBLIC_KEY }]);
}

async function privateKey(): Promise<Awaited<ReturnType<typeof webcrypto.subtle.importKey>>> {
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  return await webcrypto.subtle.importKey("pkcs8", Buffer.concat([prefix, PRIVATE_SEED]), { name: "Ed25519" }, false, ["sign"]);
}

async function signRaw(protectedJson: string, payloadJson: string): Promise<string> {
  const head = encodeBase64Url(new TextEncoder().encode(protectedJson));
  const body = encodeBase64Url(new TextEncoder().encode(payloadJson));
  const signature = await webcrypto.subtle.sign({ name: "Ed25519" }, await privateKey(), new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function signValues(header: unknown, payload: unknown): Promise<string> {
  return await signRaw(canonicalJson(header), canonicalJson(payload));
}

function vectorPayload(): Record<string, unknown> {
  return JSON.parse(Buffer.from(PAYLOAD, "base64url").toString("utf8")) as Record<string, unknown>;
}

test("matches the binding RFC 8032 deterministic vector and hashes", async () => {
  assert.equal(createHash("sha256").update(`${PROTECTED}.${PAYLOAD}`).digest("hex"), "a9d432e9c5a9acb30e2bd770f4c9f8547a0472a9f0b3d281cd99c0f0696008af");
  assert.equal(createHash("sha256").update(VECTOR).digest("hex"), "5483f9f6275376ca93f53ed6a16430176140f436e5cf2dec1927e1b766bd17bf");
  const claims = await (await verifier()).verify(VECTOR, 1_788_408_000);
  assert.equal(claims.envelopeKid, "test-a");
  assert.equal(claims.kind, "voice");
});

test("rejects signature bit flip, padding and malformed segment count", async () => {
  const candidate = await verifier();
  await assert.rejects(candidate.verify(`${PROTECTED}.${PAYLOAD}.${SIGNATURE.slice(0, -1)}A`, 1_788_408_000), /signature/);
  await assert.rejects(candidate.verify(`${PROTECTED}=.${PAYLOAD}.${SIGNATURE}`, 1_788_408_000));
  await assert.rejects(candidate.verify(`${PROTECTED}.${PAYLOAD}`, 1_788_408_000), /three/);
});

test("rejects signed alg, typ, kid and unknown-header confusion", async () => {
  const candidate = await verifier();
  for (const header of [
    { alg: "HS256", kid: "test-a", typ: "TW-MEDIA-DISPATCH+jws" },
    { alg: "EdDSA", kid: "test-a", typ: "JWT" },
    { alg: "EdDSA", kid: "removed", typ: "TW-MEDIA-DISPATCH+jws" },
    { alg: "EdDSA", kid: "test-a", typ: "TW-MEDIA-DISPATCH+jws", x: true },
  ]) await assert.rejects(candidate.verify(await signValues(header, vectorPayload()), 1_788_408_000));
});

test("rejects signed noncanonical and duplicate-key JSON", async () => {
  const candidate = await verifier();
  const payload = canonicalJson(vectorPayload());
  const noncanonical = '{"typ":"TW-MEDIA-DISPATCH+jws","kid":"test-a","alg":"EdDSA"}';
  const duplicate = '{"alg":"EdDSA","kid":"test-a","kid":"test-a","typ":"TW-MEDIA-DISPATCH+jws"}';
  await assert.rejects(candidate.verify(await signRaw(noncanonical, payload), 1_788_408_000), /canonical/);
  await assert.rejects(candidate.verify(await signRaw(duplicate, payload), 1_788_408_000), /canonical/);
  const duplicatePayload = payload.replace(/"version":1}$/, '"version":1,"version":1}');
  await assert.rejects(candidate.verify(await signRaw(canonicalJson({ alg: "EdDSA", kid: "test-a", typ: "TW-MEDIA-DISPATCH+jws" }), duplicatePayload), 1_788_408_000), /canonical/);
});

test("accepts current/prior keys only and rejects invalid allow-lists", async () => {
  const prior = new Uint8Array(32).fill(7);
  await assert.doesNotReject(Ed25519EnvelopeVerifier.create([
    { kid: "test-a", publicKey: PUBLIC_KEY },
    { kid: "prior-b", publicKey: prior },
  ]));
  await assert.rejects(Ed25519EnvelopeVerifier.create([]));
  await assert.rejects(Ed25519EnvelopeVerifier.create([
    { kid: "test-a", publicKey: PUBLIC_KEY },
    { kid: "duplicate", publicKey: PUBLIC_KEY },
  ]));
});

test("rejects signed wrong purpose, unknown payload, path and time boundaries", async () => {
  const candidate = await verifier();
  const base = vectorPayload();
  const cases = [
    { ...base, purpose: "complete" },
    { ...base, unknown: true },
    { ...base, source: { ...(base.source as object), path: "staging/00000000-0000-4000-8000-000000000004/00000000-0000-4000-8000-000000000099/source" } },
    { ...base, iat: 1_788_408_011, exp: 1_788_408_120 },
    { ...base, exp: 1_788_408_000 },
  ];
  for (const payload of cases) {
    await assert.rejects(candidate.verify(await signValues({ alg: "EdDSA", kid: "test-a", typ: "TW-MEDIA-DISPATCH+jws" }, payload), 1_788_408_000));
  }
});
