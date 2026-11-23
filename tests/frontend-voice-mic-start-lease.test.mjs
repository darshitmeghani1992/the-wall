import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/lib/recording.ts", import.meta.url), "utf8");
const start = source.split("  async function start() {")[1]?.split("\n  async function stop() {")[0] ?? "";

test("duplicate start taps are excluded before any async permission request", () => {
  assert.match(source, /const starting = useRef\(false\)/);
  assert.match(start, /if \(starting\.current \|\| recRef\.current\) return;\s*starting\.current = true/);
  assert.ok(start.indexOf("starting.current = true") < start.indexOf("Audio.requestPermissionsAsync()"));
  assert.match(start, /finally \{\s*starting\.current = false/);
});

test("reset or unmount during permission / audio setup prevents late mic start", () => {
  assert.match(start, /const generation = captureGeneration\.current/);
  assert.match(start, /const isCurrent = \(\) => captureGeneration\.current === generation/);
  assert.ok(start.indexOf("if (!isCurrent()) return;") > start.indexOf("Audio.requestPermissionsAsync()"));
  assert.ok(start.lastIndexOf("if (!isCurrent()) return;") > start.indexOf("Audio.setAudioModeAsync("));
  assert.match(source, /captureGeneration\.current \+= 1;\s*void unload\(\)/);
  assert.match(source, /async function reset\(\) \{\s*captureGeneration\.current \+= 1/);
});

test("prepared-but-cancelled mic is unloaded rather than attached", () => {
  assert.match(start, /await rec\.prepareToRecordAsync\([\s\S]*?if \(!isCurrent\(\)\) \{\s*try \{ await rec\.stopAndUnloadAsync\(\)/);
  assert.match(start, /await rec\.startAsync\(\);\s*if \(!isCurrent\(\) \|\| recRef\.current !== rec\)/);
  assert.match(start, /rec\.setOnRecordingStatusUpdate\(\(status\) => \{\s*if \(!isCurrent\(\) \|\| recRef\.current !== rec \|\| !status\.isRecording\) return/);
  assert.match(start, /catch \(cause\) \{[\s\S]*await rec\.stopAndUnloadAsync\(\)/);
});
