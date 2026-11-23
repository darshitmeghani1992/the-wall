import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the recorder time limit and manual stop share the composer attachment callback", () => {
  const recorder = readFileSync(new URL("../src/lib/recording.ts", import.meta.url), "utf8");
  const composer = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");
  assert.match(recorder, /if \(ms >= MAX_VOICE_MS\) void stop\(\)/);
  assert.match(recorder, /await finishVoiceCapture\(rec, latestDurationMs\.current, isCurrent, clipReady\.current\)/);
  assert.match(composer, /useVoiceRecorder\(attachVoiceClip\)/);
  assert.match(composer, /if \(recording\) await recorder\.stop\(\)/);
});
