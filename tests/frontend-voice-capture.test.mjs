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

test("pending microphone permission is a real composer lifecycle gate, not an idle gap", () => {
  const recorder = readFileSync(new URL("../src/lib/recording.ts", import.meta.url), "utf8");
  const composer = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");

  assert.match(recorder, /phase: "idle" \| "starting" \| "recording" \| "stopped"/);
  assert.match(recorder, /starting\.current = true;\s*setPhase\("starting"\)/);
  assert.ok(recorder.indexOf('setPhase("starting")') < recorder.indexOf("Audio.requestPermissionsAsync()"));
  assert.match(recorder, /if \(!perm\.granted\) \{\s*setDenied\(true\);\s*setPhase\("idle"\)/);
  assert.match(composer, /const voiceStarting = recorder\.phase === "starting"/);
  assert.match(composer, /const voiceBusy = recording \|\| voiceStarting/);
  assert.match(composer, /!voiceBusy && \(pollMode \? canSubmitPoll/);
  assert.match(composer, /usePreventRemove\(\(hasContent \|\| voiceBusy \|\| submissionLocked\)/);
  assert.match(composer, /if \(!hasContent && !voiceBusy\) return router\.back\(\)/);
  assert.match(composer, /voiceStarting \? <View accessibilityRole="alert"/);
  assert.match(composer, /if \(mediaAppActive\) return;[\s\S]*?void recorder\.reset\(\);\s*setMedia/);
  assert.match(composer, /if \(isCurrentScope\(\)\) Alert\.alert\("Couldn.t record"/);
});
