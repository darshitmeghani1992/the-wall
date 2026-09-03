import assert from "node:assert/strict";
import test from "node:test";
import { assertCallbackUrl, assertHostnameResolvesPublic, assertStorageObjectUrl, type UrlPolicy } from "../src/url-policy.js";

const policy: UrlPolicy = {
  storageHostname: "project.supabase.co",
  callbackOrigin: "https://project.supabase.co",
  callbackPath: "/functions/v1/mark-media-worker/worker/complete",
};
const objectPath = "validated/upload/attempt/full.jpg";

test("accepts exact bound signed Storage URLs", () => {
  const download = `https://project.supabase.co/storage/v1/object/sign/mark-media/${objectPath}?token=secret`;
  const upload = `https://project.supabase.co/storage/v1/object/upload/sign/mark-media/${objectPath}?token=secret`;
  assert.equal(assertStorageObjectUrl(download, objectPath, "download", policy).hostname, policy.storageHostname);
  assert.equal(assertStorageObjectUrl(upload, objectPath, "upload", policy).hostname, policy.storageHostname);
});

test("rejects alternate origins, IP literals, ports, userinfo, fragments and path substitution", () => {
  const candidates = [
    `https://evil.example/storage/v1/object/sign/mark-media/${objectPath}?token=x`,
    `https://127.0.0.1/storage/v1/object/sign/mark-media/${objectPath}?token=x`,
    `https://project.supabase.co:444/storage/v1/object/sign/mark-media/${objectPath}?token=x`,
    `https://user@project.supabase.co/storage/v1/object/sign/mark-media/${objectPath}?token=x`,
    `https://project.supabase.co/storage/v1/object/sign/mark-media/${objectPath}?token=x#fragment`,
    `https://project.supabase.co/storage/v1/object/sign/mark-media/${objectPath}`,
    "https://project.supabase.co/storage/v1/object/sign/mark-media/validated/other/full.jpg?token=x",
  ];
  for (const candidate of candidates) {
    assert.throws(() => assertStorageObjectUrl(candidate, objectPath, "download", policy));
  }
});

test("rejects encoded traversal and double encoding", () => {
  for (const path of ["validated/%2e%2e/private", "validated/%252e%252e/private", "validated%2fother/full.jpg"]) {
    const candidate = `https://project.supabase.co/storage/v1/object/sign/mark-media/${path}?token=x`;
    assert.throws(() => assertStorageObjectUrl(candidate, objectPath, "download", policy));
  }
});

test("callback must be the exact configured endpoint", () => {
  assert.doesNotThrow(() => assertCallbackUrl("https://project.supabase.co/functions/v1/mark-media-worker/worker/complete", policy));
  assert.throws(() => assertCallbackUrl("https://project.supabase.co/functions/v1/mark-media-worker/worker/complete?next=evil", policy));
  assert.throws(() => assertCallbackUrl("https://project.supabase.co/functions/v1/mark-media-worker/worker/fail", policy));
});

test("resolved private and reserved addresses are rejected", async () => {
  const privateResolver = (async () => [{ address: "169.254.169.254", family: 4 }]) as never;
  const publicResolver = (async () => [{ address: "203.0.114.10", family: 4 }]) as never;
  await assert.rejects(assertHostnameResolvesPublic("project.supabase.co", privateResolver));
  await assert.doesNotReject(assertHostnameResolvesPublic("project.supabase.co", publicResolver));
});
