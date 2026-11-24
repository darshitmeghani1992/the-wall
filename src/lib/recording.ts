import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Audio } from "expo-av";
import { finishVoiceCapture, MAX_VOICE_MS, type VoiceResult } from "./voice-recording-result";

export { MAX_VOICE_MS, type VoiceResult } from "./voice-recording-result";
/** Video Marks are capped at 30 seconds (Master Spec §25). */
export const MAX_VIDEO_MS = 30_000;

export type VoiceRecorder = {
  /** "starting" while awaiting native permission/recording, before capture is safe. */
  phase: "idle" | "starting" | "recording" | "stopped";
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
  const releaseInFlight = useRef<Promise<void> | null>(null);
  const clipReady = useRef(onClipReady);
  const captureGeneration = useRef(0);
  const starting = useRef(false);
  const appState = useRef(AppState.currentState);
  const permissionPending = useRef(false);
  const settleForegroundWait = useRef<(() => void) | null>(null);
  const latestDurationMs = useRef(0);
  clipReady.current = onClipReady;

  const trackRelease = useCallback((release: Promise<void>) => {
    const pending = release.finally(() => { releaseInFlight.current = null; });
    releaseInFlight.current = pending;
    return pending;
  }, []);

  const invalidateCapture = useCallback(async () => {
    captureGeneration.current += 1;
    permissionPending.current = false;
    settleForegroundWait.current?.();
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      trackRelease(rec.stopAndUnloadAsync().then(() => undefined, () => undefined));
    }
    if (releaseInFlight.current) {
      // The explicit stop caller owns any finalization error.
      await releaseInFlight.current.catch(() => undefined);
    }
  }, [trackRelease]);

  const reset = useCallback(async () => {
    const released = invalidateCapture();
    const generation = captureGeneration.current;
    await released;
    if (generation !== captureGeneration.current) return;
    setElapsedMs(0);
    setPhase("idle");
  }, [invalidateCapture]);

  useEffect(() => {
    appState.current = AppState.currentState;
    const subscription = AppState.addEventListener("change", (state) => {
      appState.current = state;
      if (state === "active") {
        settleForegroundWait.current?.();
      } else if (state !== "inactive" || !permissionPending.current) {
        // An iOS permission sheet can temporarily deactivate the app. Only
        // the permission step may survive that interruption, never capture.
        void reset();
      }
    });
    return () => {
      subscription.remove();
      void invalidateCapture();
    };
  }, [invalidateCapture, reset]);

  async function start() {
    // A second tap must not start a second native microphone recorder.
    const isForeground = () => appState.current === "active";
    if (starting.current || recRef.current || releaseInFlight.current || !isForeground()) return;
    starting.current = true;
    setPhase("starting");
    const generation = ++captureGeneration.current;
    const isCurrent = () => captureGeneration.current === generation;
    let rec: Audio.Recording | null = null;

    try {
      setDenied(false);
      permissionPending.current = true;
      const perm = await Audio.requestPermissionsAsync();
      if (!isCurrent()) return;
      while (appState.current === "inactive") {
        // Native permission can resolve before iOS reports the app active.
        await new Promise<void>((resolve) => {
          settleForegroundWait.current = resolve;
        });
        settleForegroundWait.current = null;
        if (!isCurrent()) return;
      }
      permissionPending.current = false;
      if (!isForeground()) return;
      if (!perm.granted) {
        setDenied(true);
        setPhase("idle");
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
      if (!isCurrent()) return;
      setPhase("idle");
      throw cause;
    } finally {
      permissionPending.current = false;
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
      await trackRelease(finishVoiceCapture(rec, latestDurationMs.current, isCurrent, clipReady.current));
    } finally {
      if (isCurrent()) setPhase("stopped");
    }
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
