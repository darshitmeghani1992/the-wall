import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { DEFERRED_DESTINATION_TTL_MS, deferredRecordIsExpired, isAuthCallbackIntent, parseDeferredDestinationUrl, parseStoredDeferredDestination, serializeDeferredDestinationRecord } from "./deferred-destination-contract.ts";

const A = "11111111-1111-4111-8111-111111111111";
const WALL = "22222222-2222-4222-8222-222222222222";
const MARK = "33333333-3333-4333-8333-333333333333";

assert.deepEqual(parseDeferredDestinationUrl("THEWALL://u/%40MaYa"), { kind: "personal_handle", handle: "maya" });
assert.deepEqual(parseDeferredDestinationUrl("thewall:///u/maya"), { kind: "personal_handle", handle: "maya" });
assert.deepEqual(parseDeferredDestinationUrl(`thewall://person/${A.toUpperCase()}`), { kind: "personal_user", userId: A });
assert.deepEqual(parseDeferredDestinationUrl(`thewall://s/${WALL}`), { kind: "shared_wall", wallId: WALL });
assert.deepEqual(parseDeferredDestinationUrl(`thewall://shared/${WALL}`), { kind: "shared_wall", wallId: WALL });
assert.deepEqual(parseDeferredDestinationUrl(`thewall://shared/invite/${WALL}`), { kind: "shared_invite", wallId: WALL });
assert.deepEqual(parseDeferredDestinationUrl(`thewall://person/${A}?focusMark=${MARK}`), {
  kind: "mark", markId: MARK, container: { kind: "personal", ownerId: A },
});
assert.deepEqual(parseDeferredDestinationUrl(`thewall://shared/${WALL}?focusMark=${MARK}`), {
  kind: "mark", markId: MARK, container: { kind: "shared", wallId: WALL },
});

for (const rejected of [
  "https://thewall.app/u/maya",
  "thewall://u/ma*ya",
  "thewall://u/ma",
  "thewall://u/@@maya",
  "thewall://u/maya/extra",
  "thewall://u//maya",
  "thewall://u/maya/",
  "thewall:///u//maya",
  "thewall://u/ma%2Fya",
  "thewall://u/ma%5Cya",
  "thewall://u/ma\\ya",
  "thewall://u/ma%zzya",
  "thewall://user:secret@u/maya",
  "thewall://u:42/maya",
  "thewall://u/maya#fragment",
  "thewall://u/maya?unknown=1",
  `thewall://person/${A}?focusMark=${MARK}&focusMark=${MARK}`,
  `thewall://person/${A}?__deferred_ref=external`,
  `thewall://u/maya?focusMark=${MARK}`,
  "thewall://auth/callback?code=secret",
  "thewall://settings",
  `thewall://person/not-a-uuid`,
  `thewall://shared/invite/${WALL}/extra`,
  `thewall://shared//invite/${WALL}`,
  `thewall://u/${"a".repeat(8_200)}`,
  "thewall://u/ma\u0000ya",
]) assert.equal(parseDeferredDestinationUrl(rejected), null, rejected);

assert.equal(isAuthCallbackIntent("thewall://auth/callback?code=secret"), true);
assert.equal(isAuthCallbackIntent("thewall://u/auth"), false);
assert.equal(parseDeferredDestinationUrl(`thewall://u/${"a".repeat(7_000)}`)?.kind, "personal_handle", "no invented handle maximum below the transport ceiling");

const record = {
  version: 1 as const,
  capturedAtMs: 1_000,
  boundSubject: A,
  destination: { kind: "shared_wall" as const, wallId: WALL },
};
assert.deepEqual(parseStoredDeferredDestination(serializeDeferredDestinationRecord(record)), record);
assert.equal(parseStoredDeferredDestination(JSON.stringify({ ...record, extra: true })), null);
assert.equal(parseStoredDeferredDestination(JSON.stringify({ ...record, destination: { ...record.destination, extra: true } })), null);
assert.equal(parseStoredDeferredDestination(JSON.stringify({ ...record, capturedAtMs: 1.5 })), null);
assert.equal(parseStoredDeferredDestination(JSON.stringify({ ...record, boundSubject: "bad" })), null);
assert.equal(parseStoredDeferredDestination("x".repeat(16 * 1024 + 1)), null);
assert.equal(deferredRecordIsExpired(record, 999), true, "future capture is unsafe");
assert.equal(deferredRecordIsExpired(record, 1_000 + DEFERRED_DESTINATION_TTL_MS - 1), false);
assert.equal(deferredRecordIsExpired(record, 1_000 + DEFERRED_DESTINATION_TTL_MS), true, "equality is expired");

console.log("deferred destination contract: strict parser, record, and TTL boundaries passed");
