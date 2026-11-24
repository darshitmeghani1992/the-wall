import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

test("the recorder time limit and manual stop share the composer attachment callback", () => {
  const recorder = readFileSync(new URL("../src/lib/recording.ts", import.meta.url), "utf8");
  const composer = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");
  assert.match(recorder, /if \(ms >= MAX_VOICE_MS\) void stop\(\)/);
  assert.match(recorder, /await trackRelease\(finishVoiceCapture\(rec, latestDurationMs\.current, isCurrent, clipReady\.current\)\)/);
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
  assert.match(composer, /if \(mediaAppActive\) return;\s*setMedia/);
  assert.match(composer, /const resetRecording = recorder\.reset\(\);\s*if \(currentUserId\) await Promise\.allSettled/);
  assert.match(composer, /if \(isCurrentScope\(\)\) Alert\.alert\("Couldn.t record"/);
});

function voiceRecorderHarness({ waitForUnload = false } = {}) {
  const source = readFileSync(new URL("../src/lib/recording.ts", import.meta.url), "utf8")
    .replace(/^(?:import |export \{).*$/gm, "")
    .replace(/^export /gm, "");
  const permission = Promise.withResolvers();
  const unload = Promise.withResolvers();
  const appState = { currentState: "active" };
  const recording = { starts: 0, unloads: 0 };
  const states = new Map();
  let onChange;
  let unmount;
  appState.addEventListener = (_event, listener) => {
    onChange = listener;
    return { remove() { onChange = undefined; } };
  };
  const imports = {
    useCallback: (callback) => callback,
    useEffect: (effect) => { unmount = effect(); },
    useRef: (current) => ({ current }),
    useState: (initial) => [initial, (next) => states.set(initial, next)],
    AppState: appState,
    finishVoiceCapture: (rec) => rec.stopAndUnloadAsync(),
    Audio: {
      requestPermissionsAsync: () => permission.promise,
      async setAudioModeAsync() {},
      RecordingOptionsPresets: { HIGH_QUALITY: {} },
      Recording: class {
        async prepareToRecordAsync() {}
        setProgressUpdateInterval() {}
        setOnRecordingStatusUpdate() {}
        async startAsync() { recording.starts += 1; }
        async stopAndUnloadAsync() {
          recording.unloads += 1;
          if (waitForUnload) await unload.promise;
        }
      },
    },
  };
  // Load the real hook with lightweight native and React stand-ins.
  const useVoiceRecorder = new Function(...Object.keys(imports),
    `${stripTypeScriptTypes(source)}\nreturn useVoiceRecorder;`)(...Object.values(imports));
  const recorder = useVoiceRecorder(() => {});
  return {
    recorder, recording, states, permission, unload, unmount,
    changeAppState(state) {
      appState.currentState = state;
      onChange?.(state);
    },
  };
}

test("voice starts with granted permission in the foreground and unloads on interruption", async () => {
  const { recorder, recording, permission, changeAppState } = voiceRecorderHarness();
  const started = recorder.start();
  permission.resolve({ granted: true });
  await started;
  assert.equal(recording.starts, 1);
  changeAppState("inactive");
  changeAppState("active");
  assert.deepEqual(recording, { starts: 1, unloads: 1 });
});

test("interruptions wait for native release whether it was started by stop or reset", async () => {
  for (const stopManually of [true, false]) {
    const { recorder, recording, states, permission, unload, changeAppState } = voiceRecorderHarness({ waitForUnload: true });
    const started = recorder.start();
    permission.resolve({ granted: true });
    await started;
    const stopped = stopManually ? recorder.stop() : undefined;
    changeAppState("inactive");
    changeAppState("background");
    changeAppState("active");
    await recorder.start();
    assert.deepEqual(recording, { starts: 1, unloads: 1 });
    assert.equal(states.get("idle"), "recording");
    unload.resolve();
    await stopped;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(states.get("idle"), "idle");
    await recorder.start();
    assert.deepEqual(recording, { starts: 2, unloads: 1 });
    assert.equal(states.get("idle"), "recording");
  }
});

test("a microphone grant starts after the app is active in either event order", async () => {
  for (const grantBeforeActive of [true, false]) {
    const { recorder, recording, states, permission, changeAppState } = voiceRecorderHarness();
    const started = recorder.start();
    changeAppState("inactive");
    if (grantBeforeActive) permission.resolve({ granted: true });
    await Promise.resolve();
    assert.equal(states.get("idle"), "starting");
    assert.equal(recording.starts, 0);
    changeAppState("active");
    if (!grantBeforeActive) permission.resolve({ granted: true });
    await started;
    assert.equal(recording.starts, 1);
  }
});

test("microphone denial remains visible when iOS reactivates before the callback", async () => {
  const { recorder, recording, states, permission, changeAppState } = voiceRecorderHarness();
  const started = recorder.start();
  changeAppState("inactive");
  changeAppState("active");
  permission.resolve({ granted: false });
  await started;
  assert.equal(states.get(false), true);
  assert.equal(states.get("idle"), "idle");
  assert.equal(recording.starts, 0);
});

test("backgrounding requires a new tap whether permission has resolved or is pending", async () => {
  for (const grantBeforeBackground of [true, false]) {
    const { recorder, recording, states, permission, changeAppState } = voiceRecorderHarness();
    const started = recorder.start();
    changeAppState("inactive");
    if (grantBeforeBackground) permission.resolve({ granted: true });
    await Promise.resolve();
    changeAppState("background");
    changeAppState("active");
    if (!grantBeforeBackground) permission.resolve({ granted: true });
    await started;
    assert.equal(states.get("idle"), "idle");
    assert.equal(recording.starts, 0);
    await recorder.start();
    assert.equal(recording.starts, 1);
  }
});

test("unmount or discard cancels permission before any native start", async () => {
  for (const cancel of [(harness) => harness.unmount(), (harness) => harness.recorder.reset()]) {
    const harness = voiceRecorderHarness();
    const started = harness.recorder.start();
    harness.changeAppState("inactive");
    await cancel(harness);
    harness.permission.resolve({ granted: true });
    harness.changeAppState("active");
    await started;
    assert.equal(harness.recording.starts, 0);
  }
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
