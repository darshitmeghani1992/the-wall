import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free contract tests load source directly.
import { finishVoiceCapture, MAX_VOICE_MS } from "./voice-recording-result.ts";
import type { VoiceResult } from "./voice-recording-result";

const uri = "file:///voice.m4a";

test("a manual stop and the time cap each deliver an attachable recording", async () => {
  for (const durationMillis of [8_000, 60_100]) {
    const clips: VoiceResult[] = [];
    await finishVoiceCapture(
      { stopAndUnloadAsync: async () => ({ durationMillis }), getURI: () => uri },
      durationMillis,
      () => true,
      async (clip) => { clips.push(clip); },
    );
    assert.deepEqual(clips, [{ uri, mime: "audio/m4a", durationMs: Math.min(durationMillis, MAX_VOICE_MS) }]);
  }
});

test("the last progress update supplies the duration when native stop omits it", async () => {
  const clips: VoiceResult[] = [];
  await finishVoiceCapture(
    { stopAndUnloadAsync: async () => ({}), getURI: () => uri },
    MAX_VOICE_MS,
    () => true,
    async (clip) => { clips.push(clip); },
  );
  assert.equal(clips[0]?.durationMs, MAX_VOICE_MS);
});

test("an interrupted stop cannot attach to a discarded recorder", async () => {
  let current = true;
  await finishVoiceCapture(
    {
      stopAndUnloadAsync: async () => { current = false; return { durationMillis: 5_000 }; },
      getURI: () => uri,
    },
    5_000,
    () => current,
    async () => { assert.fail("discarded capture was delivered"); },
  );
});

test("a failed native stop must never attach an incomplete recording", async () => {
  let uriRead = false;
  let delivered = false;
  await finishVoiceCapture(
    {
      stopAndUnloadAsync: async () => { throw new Error("recording could not finalize"); },
      getURI: () => { uriRead = true; return uri; },
    },
    15_000,
    () => true,
    async () => { delivered = true; },
  );
  assert.equal(uriRead, false, "do not trust the recorder URI after a failed stop");
  assert.equal(delivered, false, "do not attach an unfinalized audio file");
});
