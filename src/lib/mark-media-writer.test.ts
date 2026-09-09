import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { advanceMediaDraft, cancelMediaDraft, createMediaMark, createMediaMarkGuarded, createMediaWriterDraft, isAllowedProtectedResumeUrl, MediaWriterError, parseCreateMediaMark, parseMediaCancellation, parseMediaReservation, parseMediaStatuses, parseMediaUploaded, parseProtectedResumeIndex, prepareMediaMarkRequest, protectedResumeEntryMatches, removeProtectedResumeScope, shouldResetProtectedResumeState, type MediaWriterDraft } from "./mark-media-writer.ts";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { TextSubmissionLock } from "./mark-writer-contract.ts";

const WALL = "00000000-0000-4000-8000-000000000001";
const CLIENT = "00000000-0000-4000-8000-000000000002";
const UPLOAD = "00000000-0000-4000-8000-000000000003";
const REQUEST = "00000000-0000-4000-8000-000000000004";
const MARK = "00000000-0000-4000-8000-000000000005";
const EXPIRY = "2099-01-01T00:00:00Z";

async function main() {
  const transportSource = readFileSync("src/lib/upload.ts", "utf8");
  const authSource = readFileSync("src/lib/auth.tsx", "utf8");
  const duplicateTusBranch = transportSource.match(/const existing = activeTusUploads\.get\(fingerprint\);([\s\S]*?)let resolveUpload/);
  assert.ok(duplicateTusBranch?.[1].includes("if (existing) return existing.promise;"),
    "a duplicate active TUS attempt joins the shared promise");
  assert.equal(duplicateTusBranch?.[1].includes(".start()"), false,
    "a duplicate active TUS attempt never starts the Upload twice");
  assert.match(transportSource, /resumeResetEpoch \+= 1;[\s\S]*detachLate/,
    "global reset invalidates late addUpload callbacks and performs a second serialized detach");
  assert.match(transportSource, /this\.resetEpoch !== resumeResetEpoch[\s\S]*MARK_MEDIA_SESSION_CHANGED/,
    "add-vs-reset ordering fails closed before a resume index can be recreated");
  assert.match(authSource, /try \{ await resetProtectedMediaUploads\(\); \} catch \{[^}]*\}\s*await supabase\.auth\.signOut\(\);/,
    "explicit logout always invokes the local reset while preserving Supabase sign-out");
  assert.equal(shouldResetProtectedResumeState("INITIAL_SESSION", WALL, CLIENT), false);
  assert.equal(shouldResetProtectedResumeState("TOKEN_REFRESHED", WALL, WALL), false);
  assert.equal(shouldResetProtectedResumeState("USER_UPDATED", WALL, WALL), false);
  assert.equal(shouldResetProtectedResumeState("SIGNED_IN", undefined, WALL), false);
  assert.equal(shouldResetProtectedResumeState("SIGNED_IN", WALL, CLIENT), true);
  assert.equal(shouldResetProtectedResumeState("SIGNED_OUT", WALL, null), true);
  const reservationRaw = { status: "ready", upload_id: UPLOAD, bucket: "mark-media", path: `staging/${WALL}/${UPLOAD}/source`, expires_at: EXPIRY };
  assert.deepEqual(parseMediaReservation(reservationRaw, WALL, 0), {
    status: "ready", uploadId: UPLOAD, bucket: "mark-media", path: reservationRaw.path, expiresAt: EXPIRY,
  });
  assert.equal(parseMediaReservation({ ...reservationRaw, source_path: reservationRaw.path }, WALL, 0), null, "extra protected fields fail closed");
  assert.equal(parseMediaReservation({ ...reservationRaw, path: `staging/${CLIENT}/${UPLOAD}/source` }, WALL, 0), null, "reservation path is bound to the verified subject");
  const postgresExpiry = { ...reservationRaw, expires_at: "2099-01-01T00:00:00+00:00" };
  assert.deepEqual(parseMediaReservation(postgresExpiry, WALL, 0), {
    status: "ready", uploadId: UPLOAD, bucket: "mark-media", path: postgresExpiry.path, expiresAt: postgresExpiry.expires_at,
  },
    "PostgreSQL's strict UTC timestamptz representation is accepted");
  assert.equal(parseMediaReservation({ ...reservationRaw, expires_at: "2099-01-01T05:30:00+05:30" }, WALL, 0), null,
    "non-UTC or loosely formatted expiry values fail closed");
  assert.equal(parseMediaReservation({ ...reservationRaw, expires_at: "2099-99-99T99:99:99Z" }, WALL, 0), null,
    "regex-shaped but invalid reservation timestamps fail closed");
  const fingerprint = `${WALL}:${UPLOAD}:7:${reservationRaw.path}`;
  const resumeEntry = { fingerprint, storageKey: "tw_media_tus_1a2b3c", subject: WALL, uploadId: UPLOAD,
    sessionGeneration: 7, path: reservationRaw.path, expiresAt: EXPIRY };
  assert.deepEqual(parseProtectedResumeIndex([resumeEntry], 0), [resumeEntry], "restart index retains strict live scope metadata");
  assert.equal(protectedResumeEntryMatches(resumeEntry, { ...resumeEntry, sessionGeneration: 8 }), false,
    "a session-generation rotation cannot reuse the prior reservation");
  const nextSessionEntry = { ...resumeEntry, fingerprint: `${WALL}:${UPLOAD}:8:${reservationRaw.path}`, sessionGeneration: 8 };
  assert.deepEqual(removeProtectedResumeScope([resumeEntry, nextSessionEntry], WALL, 7, "exact"), [nextSessionEntry],
    "logout/session cleanup removes the exact departing generation");
  assert.deepEqual(removeProtectedResumeScope([resumeEntry, nextSessionEntry], WALL, 8, "other"), [nextSessionEntry],
    "restart cleanup removes every stale generation but preserves the current one");
  assert.equal(parseProtectedResumeIndex([{ ...resumeEntry, path: `staging/${CLIENT}/${UPLOAD}/source` }], 0), null,
    "tampered subject/path index fails closed");
  assert.equal(parseProtectedResumeIndex([{ ...resumeEntry, expiresAt: "2000-01-01T00:00:00Z" }]), null,
    "expired resume records trigger cleanup");
  assert.equal(parseProtectedResumeIndex([{ ...resumeEntry, expiresAt: "2099-99-99T99:99:99Z" }], 0), null,
    "regex-shaped but invalid resume timestamps fail closed");
  const tusEndpoint = "https://project-ref.storage.supabase.co/storage/v1/upload/resumable";
  assert.equal(isAllowedProtectedResumeUrl(`${tusEndpoint}/opaque-token`, tusEndpoint), true);
  for (const unsafeUrl of [`${tusEndpoint}/nested/token`, `${tusEndpoint}/token?leak=1`,
    "https://project-ref.supabase.co/storage/v1/upload/resumable/token",
    "https://evil.example/storage/v1/upload/resumable/token", `${tusEndpoint}/%2Fadmin`]) {
    assert.equal(isAllowedProtectedResumeUrl(unsafeUrl, tusEndpoint), false, `tampered resume URL is rejected: ${unsafeUrl}`);
  }
  assert.equal(parseMediaUploaded({ status: "uploaded" }), "uploaded");
  assert.deepEqual(parseMediaUploaded({ status: "failed", error_code: "INVALID_MEDIA" }), { status: "failed", errorCode: "INVALID_MEDIA" });
  assert.equal(parseMediaUploaded({ status: "failed", error_code: "raw parser detail" }), null);
  assert.deepEqual(parseMediaStatuses([{ upload_id: UPLOAD, state: "processing" }]), [{ uploadId: UPLOAD, state: "processing" }]);
  assert.equal(parseMediaStatuses([{ upload_id: UPLOAD, state: "consumed" }]), null, "consumed is not a public client state");
  assert.equal(parseMediaCancellation({ status: "cancelled" }), "cancelled");
  assert.equal(parseMediaCancellation({ status: "unavailable", reason: "foreign" }), null, "generic cancellation cannot become an oracle");
  assert.deepEqual(parseCreateMediaMark({ status: "created", mark_id: MARK, mark_status: "active" }), {
    status: "created", markId: MARK, markStatus: "active",
  });

  let statuses = 0;
  const calls: string[] = [];
  const rpc = {
    async begin(args: Record<string, unknown>) {
      calls.push("begin");
      assert.deepEqual(args, {
        p_wall_id: WALL, p_kind: "photo", p_client_upload_id: CLIENT,
        p_declared_mime: "image/jpeg", p_declared_bytes: 1234,
      });
      return reservationRaw;
    },
    async uploaded(args: Record<string, unknown>) {
      calls.push("uploaded");
      assert.deepEqual(args, { p_upload_id: UPLOAD });
      return { status: "uploaded" };
    },
    async status() {
      calls.push("status");
      statuses += 1;
      return [{ upload_id: UPLOAD, state: statuses === 1 ? "processing" : "validated" }];
    },
    async cancel(args: Record<string, unknown>) {
      calls.push("cancel");
      assert.deepEqual(args, { p_upload_id: UPLOAD });
      return { status: "cancelled" };
    },
    async create(args: Record<string, unknown>) {
      calls.push("create");
      assert.deepEqual(args, {
        p_request_id: REQUEST, p_wall_id: WALL, p_type: "photo", p_text: "caption", p_color: null,
        p_anonymous: true, p_secret: false, p_rotation: 1.2, p_upload_ids: [UPLOAD],
      });
      return { status: "created", mark_id: MARK, mark_status: "active" };
    },
  };
  const updates: string[] = [];
  const selected = createMediaWriterDraft({ kind: "photo", uri: "file:///photo.jpg", mime: "IMAGE/JPEG", bytes: 1234 }, CLIENT);
  const validated = await advanceMediaDraft(selected, {
    wallId: WALL,
    subject: WALL,
    rpc,
    transport: async (_draft, reservation, onProgress) => {
      calls.push("transport");
      assert.equal(reservation.uploadId, UPLOAD);
      onProgress(0.25);
      onProgress(1);
    },
    update: (draft) => updates.push(`${draft.state}:${draft.progress}`),
    isCurrent: () => true,
    isActive: () => true,
    wait: async () => undefined,
  });
  assert.equal(validated.state, "validated");
  assert.deepEqual(calls.slice(0, 5), ["begin", "transport", "uploaded", "status", "status"], "reservation, upload, transition, and bounded validation are ordered");
  assert.ok(updates.includes("uploading:0.25"), "transport progress reaches the per-item state machine");

  const created = await createMediaMark({
    requestId: REQUEST, wallId: WALL, type: "photo", text: "  caption  ", anonymous: true, rotation: 1.2, uploads: [validated],
  }, rpc);
  assert.deepEqual(created, { status: "created", markId: MARK, markStatus: "active" });
  const frozen = prepareMediaMarkRequest({ wallId: WALL, type: "photo", text: " caption ", anonymous: true,
    uploads: [validated] }, null, () => REQUEST, () => 1.2);
  assert.equal(prepareMediaMarkRequest({ wallId: WALL, type: "photo", text: "caption", anonymous: true,
    uploads: [validated] }, frozen, () => CLIENT, () => -1), frozen, "semantic retry preserves Mark request identity");

  const postLock = new TextSubmissionLock();
  assert.equal(postLock.tryBegin(), true);
  let resolveCreate!: (value: unknown) => void;
  let lifecycleCurrent = true;
  const delayedRpc = { ...rpc, create: async () => new Promise<unknown>((resolve) => { resolveCreate = resolve; }) };
  const delayedCreate = createMediaMarkGuarded({ requestId: REQUEST, wallId: WALL, type: "photo", text: "caption",
    anonymous: true, rotation: 1.2, uploads: [validated] }, delayedRpc, () => lifecycleCurrent);
  await Promise.resolve();
  lifecycleCurrent = false;
  assert.equal(postLock.tryBegin(), false, "backgrounding after create dispatch cannot unlock a second request");
  resolveCreate({ status: "created", mark_id: MARK, mark_status: "active" });
  assert.deepEqual(await delayedCreate, { status: "stale" }, "authoritative stale success cannot navigate or emit analytics");
  postLock.finish();
  const cancelled = await cancelMediaDraft(validated, rpc);
  assert.equal(cancelled.state, "cancelled");
  await assert.rejects(
    () => cancelMediaDraft(validated, { ...rpc, cancel: async () => ({ status: "unavailable" }) }),
    (cause: unknown) => cause instanceof MediaWriterError && cause.code === "unavailable",
    "generic unavailable is never reported as confirmed cancellation",
  );

  const failedUpdates: MediaWriterDraft[] = [];
  await assert.rejects(
    () => advanceMediaDraft(selected, {
      wallId: WALL, subject: WALL, rpc,
      transport: async () => { throw new Error("offline"); },
      update: (draft) => failedUpdates.push(draft), isCurrent: () => true, isActive: () => true,
    }),
    (cause: unknown) => cause instanceof MediaWriterError && cause.code === "upload_failed" && cause.retryable,
  );
  assert.equal(failedUpdates.at(-1)?.state, "failed");
  assert.equal(failedUpdates.at(-1)?.retryFrom, "upload", "recoverable failure remains explicitly retryable/removable");

  const pausedRpc = { ...rpc, begin: async () => { throw new Error("must not call while backgrounded"); } };
  await assert.rejects(
    () => advanceMediaDraft(selected, { wallId: WALL, subject: WALL, rpc: pausedRpc, transport: async () => undefined, update: () => undefined, isCurrent: () => true, isActive: () => false }),
    (cause: unknown) => cause instanceof MediaWriterError && cause.code === "paused" && cause.retryable,
  );

  let lateUpdate = false;
  let current = true;
  const staleRpc = {
    ...rpc,
    begin: async () => {
      current = false;
      return reservationRaw;
    },
  };
  await assert.rejects(
    () => advanceMediaDraft(selected, { wallId: WALL, subject: WALL, rpc: staleRpc, transport: async () => undefined, update: () => { lateUpdate = true; }, isCurrent: () => current, isActive: () => true }),
    (cause: unknown) => cause instanceof MediaWriterError && cause.code === "stale",
  );
  assert.equal(lateUpdate, true, "only the pre-request reserving update is published before session invalidation");

  console.log("protected media writer contract: strict DTOs, ordered workflow, progress, cancellation, and lifecycle fences passed");
}

void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "protected media writer contract failed");
  process.exitCode = 1;
});
