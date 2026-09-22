import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { AsyncOperationFence, MediaFailureEpisode, ProtectedMediaCache, RuntimeUnloadRegistration, allocateMediaSessionGeneration, awaitGuarded, parseProtectedMediaManifest, selectLocalDraftPreviewUrl, type ProtectedMediaManifest } from "./mark-media.ts";

const MARK = "00000000-0000-4000-8000-000000000001";
const WALL = "00000000-0000-4000-8000-000000000002";
const SUBJECT = "00000000-0000-4000-8000-000000000003";

function ready(overrides: Record<string, unknown> = {}) {
  return {
    status: "ready",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    items: [{
      position: 0,
      media_type: "photo",
      url: "https://project.supabase.co/storage/v1/object/sign/mark-media/validated/a/full.webp?token=x",
      preview_url: null,
      mime_type: "image/webp",
      width: 1200,
      height: 900,
      duration_ms: null,
    }],
    ...overrides,
  };
}

async function main() {
  assert.ok(parseProtectedMediaManifest(ready()), "accept exact photo manifest");
  assert.equal(parseProtectedMediaManifest(ready({ sha256: "forbidden" })), null, "reject extra response fields");
  assert.equal(parseProtectedMediaManifest(ready({ items: [{
    ...ready().items[0],
    duration_ms: 1,
  }] })), null, "reject untrusted photo duration");
  assert.equal(parseProtectedMediaManifest(ready({ items: [
    { ...ready().items[0], position: 1 },
    { ...ready().items[0], position: 0 },
  ] })), null, "reject duplicate/non-contiguous ordered positions");
  assert.equal(parseProtectedMediaManifest(ready({ expires_at: new Date(Date.now() - 1).toISOString() })), null, "reject expired bearer URLs");
  assert.equal(parseProtectedMediaManifest(ready({ items: [{ ...ready().items[0], mime_type: "video/mp4" }] })), null, "bind MIME to media kind");
  assert.equal(parseProtectedMediaManifest(ready({ items: [{
    ...ready().items[0],
    media_type: "voice",
    mime_type: "audio/mp4",
    width: null,
    height: null,
    duration_ms: 30_000,
    preview_url: "https://project.supabase.co/storage/v1/object/sign/mark-media/validated/a/preview.webp?token=x",
  }] })), null, "voice manifests cannot carry previews");

  const cache = new ProtectedMediaCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    await Promise.resolve();
    return parseProtectedMediaManifest(ready())!;
  };
  const identity = { subject: SUBJECT, sessionGeneration: 1, markId: MARK };
  const [first, second] = await Promise.all([cache.read(identity, fetcher), cache.read(identity, fetcher)]);
  assert.equal(calls, 1, "deduplicate in-flight reads for one cache identity");
  assert.equal(first, second);
  await cache.read({ ...identity, sessionGeneration: 2 }, fetcher);
  assert.equal(calls, 2, "session generation isolates cache identity");
  cache.clearAll();
  await cache.read(identity, fetcher);
  assert.equal(calls, 3, "global lifecycle clear removes volatile manifests");

  const staleCache = new ProtectedMediaCache();
  let resolveStale!: (manifest: ProtectedMediaManifest) => void;
  const stale = staleCache.read(identity, () => new Promise((resolve) => { resolveStale = resolve; }) as Promise<NonNullable<ReturnType<typeof parseProtectedMediaManifest>>>);
  staleCache.clear(identity);
  resolveStale(parseProtectedMediaManifest(ready())!);
  await stale;
  let postClearCalls = 0;
  await staleCache.read(identity, async () => {
    postClearCalls += 1;
    return parseProtectedMediaManifest(ready())!;
  });
  assert.equal(postClearCalls, 1, "stale in-flight fulfillment cannot repopulate after key clear");

  let resolveGlobalStale!: (manifest: ProtectedMediaManifest) => void;
  const globalStale = staleCache.read(identity, () => new Promise((resolve) => { resolveGlobalStale = resolve; }) as Promise<NonNullable<ReturnType<typeof parseProtectedMediaManifest>>>, true);
  staleCache.clearAll();
  resolveGlobalStale(parseProtectedMediaManifest(ready())!);
  await globalStale;
  await staleCache.read(identity, async () => {
    postClearCalls += 1;
    return parseProtectedMediaManifest(ready())!;
  });
  assert.equal(postClearCalls, 2, "stale in-flight fulfillment cannot repopulate after global clear");

  const remountA = allocateMediaSessionGeneration();
  const remountB = allocateMediaSessionGeneration();
  assert.ok(remountB > remountA, "provider remounts receive process-monotonic identities");
  assert.notEqual(remountA, remountB);

  const episode = new MediaFailureEpisode();
  assert.equal(episode.begin(), "refresh");
  assert.equal(episode.begin(), "ignore", "simultaneous native failures deduplicate");
  episode.complete(false);
  assert.equal(episode.begin(), "ignore", "failed refresh is terminal without another request");
  episode.reset();
  assert.equal(episode.begin(), "refresh");
  episode.complete(true);
  assert.equal(episode.begin(), "terminal", "a second failure in one episode is terminal");

  const nativeCreate = new AsyncOperationFence();
  const pendingCreate = nativeCreate.begin();
  nativeCreate.invalidate();
  assert.equal(nativeCreate.isCurrent(pendingCreate), false, "teardown invalidates late native create completion");
  assert.equal(nativeCreate.isCurrent(nativeCreate.begin()), true);

  const delayedCreateFence = new AsyncOperationFence();
  const delayedCreateToken = delayedCreateFence.begin();
  let rejectCreate!: (cause: Error) => void;
  const delayedCreate = awaitGuarded(
    delayedCreateFence,
    delayedCreateToken,
    new Promise<string>((_resolve, reject) => { rejectCreate = reject; }),
  );
  delayedCreateFence.invalidate();
  rejectCreate(new Error("native create rejected after background"));
  assert.deepEqual(await delayedCreate, { status: "stale" }, "delayed rejection after invalidation has no error side effect");

  const delayedPlayFence = new AsyncOperationFence();
  const delayedPlayToken = delayedPlayFence.begin();
  let resolvePlay!: (value: string) => void;
  const delayedPlay = awaitGuarded(
    delayedPlayFence,
    delayedPlayToken,
    new Promise<string>((resolve) => { resolvePlay = resolve; }),
  );
  delayedPlayFence.invalidate();
  resolvePlay("playing");
  assert.deepEqual(await delayedPlay, { status: "stale" }, "play/pause completion cannot cross lifecycle invalidation");

  const staleCleanupFence = new AsyncOperationFence();
  const staleCleanupToken = staleCleanupFence.begin();
  staleCleanupFence.invalidate();
  assert.deepEqual(await awaitGuarded(staleCleanupFence, staleCleanupToken, Promise.resolve("sound"), async () => {
    throw new Error("native stale unload rejected");
  }), { status: "stale" }, "stale unload rejection is swallowed safely");

  const runtimeUnload = new RuntimeUnloadRegistration();
  let unloadCalls = 0;
  runtimeUnload.set(() => { unloadCalls += 1; });
  runtimeUnload.invoke();
  runtimeUnload.invoke();
  assert.equal(unloadCalls, 2, "foreground/play/background runtime clears retain the unload callback");
  runtimeUnload.clear();
  runtimeUnload.invoke();
  assert.equal(unloadCalls, 2, "component teardown unregisters the callback");
  runtimeUnload.set(async () => { throw new Error("native unload rejected"); });
  runtimeUnload.invoke();
  await Promise.resolve();
  await Promise.resolve();

  const persistedLegacyUrl = `https://project.supabase.co/storage/v1/object/public/attachments/marks/${WALL}/1788408000000.jpg`;
  assert.equal(selectLocalDraftPreviewUrl(MARK, persistedLegacyUrl), null, "persisted media_url is never consumed");
  assert.equal(selectLocalDraftPreviewUrl("preview", persistedLegacyUrl), null, "composer preview rejects remote URLs");
  assert.equal(selectLocalDraftPreviewUrl("preview", "file:///draft/photo.jpg"), "file:///draft/photo.jpg");
  assert.equal(selectLocalDraftPreviewUrl("preview", "content://draft/audio.m4a"), "content://draft/audio.m4a");

  console.log("mark-media client contract: parser, cache-race, session, failure-budget, unload, and local-preview boundaries passed");
}

void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "mark-media client contract failed");
  process.exitCode = 1;
});
