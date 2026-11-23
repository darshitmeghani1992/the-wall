import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import { finishVoiceCapture, MAX_VOICE_MS, type VoiceResult } from "./voice-recording-result";

export { MAX_VOICE_MS, type VoiceResult } from "./voice-recording-result";
/** Video Marks are capped at 30 seconds (Master Spec §25). */
export const MAX_VIDEO_MS = 30_000;

export type VoiceRecorder = {
  /** "idle" before first record, "recording" while capturing, "stopped" after. */
  phase: "idle" | "recording" | "stopped";
  /** Elapsed milliseconds while recording (drives the visible timer). */
  elapsedMs: number;
  /** Permission was denied — surface a settings hint instead of recording. */
  denied: boolean;
  start: () => Promise<void>;
  /** Stops and delivers a recorded clip through the same callback as the time limit. */
  stop: () => Promise<void>;
  /** Discard any in-progress/finished recording and return to idle. */
  reset: () => Promise<void>;
};

/**
 * Minimal voice recorder over expo-av. Requests mic permission on first `start`
 * (never during onboarding — §24), auto-stops at 60s, and unloads the recording
 * on stop/reset/unmount so we never leak an active recorder or the mic.
 *
 * Device-only capture: recording is exercised on a physical device (final QA
 * pending — see docs/BUILD_STATUS.md); this hook is written to the documented
 * expo-av contract and typechecks/lints in CI.
 */
export function useVoiceRecorder(onClipReady: (clip: VoiceResult) => Promise<void>): VoiceRecorder {
  const [phase, setPhase] = useState<VoiceRecorder["phase"]>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [denied, setDenied] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);
  const clipReady = useRef(onClipReady);
  const captureGeneration = useRef(0);
  const starting = useRef(false);
  const latestDurationMs = useRef(0);
  clipReady.current = onClipReady;

  async function unload() {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {
        // already stopped/unloaded — nothing to clean up
      }
    }
  }

  // Safety net: unload if the component using the recorder unmounts mid-capture.
  useEffect(() => {
    return () => {
      captureGeneration.current += 1;
      void unload();
    };
  }, []);

  async function start() {
    // A second tap must not start a second native microphone recorder.
    if (starting.current || recRef.current) return;
    starting.current = true;
    const generation = captureGeneration.current;
    const isCurrent = () => captureGeneration.current === generation;
    let rec: Audio.Recording | null = null;

    try {
      setDenied(false);
      const perm = await Audio.requestPermissionsAsync();
      if (!isCurrent()) return; // reset or unmount while native permission sheet was open
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      if (!isCurrent()) return;
      rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if (!isCurrent()) {
        try { await rec.stopAndUnloadAsync(); } catch { /* not yet recording */ }
        return;
      }
      rec.setProgressUpdateInterval(200);
      rec.setOnRecordingStatusUpdate((status) => {
        if (!isCurrent() || recRef.current !== rec || !status.isRecording) return;
        const ms = status.durationMillis ?? 0;
        latestDurationMs.current = ms;
        setElapsedMs(ms);
        if (ms >= MAX_VOICE_MS) void stop(); // hard cap at 60s
      });
      recRef.current = rec;
      latestDurationMs.current = 0;
      setElapsedMs(0);
      await rec.startAsync();
      if (!isCurrent() || recRef.current !== rec) {
        if (recRef.current === rec) recRef.current = null;
        try { await rec.stopAndUnloadAsync(); } catch { /* already released by reset */ }
        return;
      }
      setPhase("recording");
    } catch (cause) {
      if (rec && recRef.current === rec) recRef.current = null;
      if (rec) {
        try { await rec.stopAndUnloadAsync(); } catch { /* cleanup best effort */ }
      }
      if (isCurrent()) setPhase("idle");
      throw cause;
    } finally {
      starting.current = false;
    }
  }

  async function stop() {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    rec.setOnRecordingStatusUpdate(null);
    const generation = captureGeneration.current;
    const isCurrent = () => captureGeneration.current === generation;
    try {
      await finishVoiceCapture(rec, latestDurationMs.current, isCurrent, clipReady.current);
    } finally {
      if (isCurrent()) setPhase("stopped");
    }
  }

  async function reset() {
    captureGeneration.current += 1;
    await unload();
    setElapsedMs(0);
    setPhase("idle");
  }

  return { phase, elapsedMs, denied, start, stop, reset };
}

/** mm:ss for a millisecond duration (e.g. 0:07, 1:00). */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
