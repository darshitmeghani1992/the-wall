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
  assert.match(composer, /usePreventRemove\(\(hasContent \|\| voiceBusy \|\| submissionLocked \|\| pickingMedia\)/);
  assert.match(composer, /if \(!hasContent && !voiceBusy && !pickerInFlight\.current\) return router\.back\(\)/);
  assert.match(composer, /voiceStarting \? <View accessibilityRole="alert"/);
  assert.match(composer, /if \(mediaAppActive\) return;[\s\S]*?void recorder\.reset\(\);\s*setMedia/);
  assert.match(composer, /if \(isCurrentScope\(\)\) Alert\.alert\("Couldn.t record"/);
});

test("native photo and video picker results cannot outlive the editor or overwrite a competing draft", () => {
  const composer = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");
  const lease = composer.split("function beginPicker()")[1].split("function finishPicker()")[0];
  assert.match(lease, /pickerInFlight\.current = true;\s*setPickingMedia\(true\)/);
  assert.match(lease, /return \(\) => isCurrentScope\(\) && !discardConfirmedRef\.current && pickerInFlight\.current && lockRef\.current\.allowsIntent\(\)/);
  for (const name of ["pickPhotos", "pickVideo"]) {
    const body = composer.split("async function " + name)[1].split("\n  }")[0];
    assert.match(body, /const canAttach = beginPicker\(\);\s*if \(!canAttach\) return/);
    assert.match(body, /await ImagePicker\.requestCameraPermissionsAsync\(\);\s*if \(!canAttach\(\)\) return/);
    assert.match(body, /if \(result\.canceled \|\| !canAttach\(\)\) return/);
    assert.match(body, /if \(!canAttach\(\)\) return;\s*lockRef\.current\.runIntent/);
    assert.match(body, /finally \{\s*finishPicker\(\)/);
  }
  assert.match(composer, /async function submit\(\) \{\s*if \(!isCurrentScope\(\) \|\| pickerInFlight\.current/);
  assert.match(composer, /current\.length === 0 \? \[draft\] : current/);
  assert.match(composer, /current\.some\(\(item\) => item\.kind !== "photo"\) \? current/);
});

test("discard prevents submission and late voice metadata cannot replace another attachment", () => {
  const composer = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");
  const voice = composer.split("async function attachVoiceClip")[1].split("async function toggleVoice")[0];
  assert.match(composer, /async function submit\(\) \{\s*if \(!isCurrentScope\(\) \|\| pickerInFlight\.current \|\| !canSubmit \|\| discardConfirmedRef\.current/);
  assert.match(voice, /const token = lifecycleRef\.current/);
  assert.match(voice, /const canAttach = \(\) => isCurrentScope\(\) && token === lifecycleRef\.current && !discardConfirmedRef\.current && !pickerInFlight\.current/);
  assert.match(voice, /await getLocalMediaSize\(clip\.uri\);\s*if \(!canAttach\(\)\) return/);
  assert.match(voice, /current\.length === 0 \? \[draft\] : current/);
});
