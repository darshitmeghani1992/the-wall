import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL("../migrations/0023_mark_writer_contract.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

function functionBody(name) {
  const start = sql.indexOf(`create or replace function ${name}`);
  assert.notEqual(start, -1, `${name} is missing`);
  const next = sql.indexOf("create or replace function ", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

test("Secret media rejection precedes request and upload locks", () => {
  const body = functionBody("create_mark");
  const rejection = body.indexOf("if p_type<>'text' and p_secret then");
  assert.ok(rejection >= 0);
  assert.ok(rejection < body.indexOf("pg_advisory_xact_lock"));
  assert.ok(rejection < body.indexOf("from media_uploads where id=v_uid for update"));
});

test("creation exposes the bound result union without rate_limited", () => {
  const body = functionBody("create_mark");
  for (const status of [
    "unavailable",
    "invalid",
    "media_not_ready",
    "request_id_reused",
    "existing",
    "deleted",
    "created",
  ]) {
    assert.match(body, new RegExp(`'status','${status}'`));
  }
  assert.doesNotMatch(body, /rate_limited/);
});

test("status omits consumed rows and only projects safe failure codes", () => {
  const body = functionBody("get_media_upload_status");
  assert.match(body, /u\.state<>'consumed'/);
  for (const code of [
    "UNSUPPORTED_FORMAT",
    "TOO_LARGE",
    "TOO_LONG",
    "INVALID_MEDIA",
    "PROCESSING_FAILED",
  ]) {
    assert.match(body, new RegExp(`'${code}'`));
  }
  assert.doesNotMatch(body, /source_path|validated_path|lease_expires_at|uploader_tombstone_id/);
});

test("malformed worker failures are canonicalized before receipt hashing", () => {
  const body = functionBody("canonical_media_validation_result");
  const failedBranch = body.indexOf("if p_outcome='failed' then");
  const objectRejection = body.indexOf("if jsonb_typeof(p_result)<>'object' then return null");
  assert.ok(failedBranch >= 0 && failedBranch < objectRejection);
  assert.match(body, /when v_keys=1 and p_result \? 'error_code'/);
  assert.match(body, /else null/);
  assert.match(body, /normalize_media_failure_code/);
});

test("cancellation API is actor-bound and accepts no path or actor parameter", () => {
  const body = functionBody("cancel_media_upload");
  assert.match(body, /cancel_media_upload\(p_upload_id uuid\)/);
  assert.match(body, /v_actor uuid:=auth\.uid\(\)/);
  assert.doesNotMatch(body, /p_actor|p_path|p_bucket|p_prefix|p_wildcard/);
  assert.match(body, /where id=p_upload_id and uploader_id=v_actor for update/);
});
