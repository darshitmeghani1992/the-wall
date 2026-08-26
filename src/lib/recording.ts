import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

/** Voice Marks are capped at 60 seconds (Master Spec §24). */
export const MAX_VOICE_MS = 60_000;
/** Video Marks are capped at 30 seconds (Master Spec §25). */
export const MAX_VIDEO_MS = 30_000;

export type VoiceResult = { uri: string; mime: string; durationMs: number };

export type VoiceRecorder = {
  /** "idle" before first record, "recording" while capturing, "stopped" after. */
  phase: "idle" | "recording" | "stopped";
  /** Elapsed milliseconds while recording (drives the visible timer). */
  elapsedMs: number;
  /** Permission was denied — surface a settings hint instead of recording. */
  denied: boolean;
  start: () => Promise<void>;
  /** Stops and returns the recorded clip (or null if nothing usable). */
  stop: () => Promise<VoiceResult | null>;
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
export function useVoiceRecorder(): VoiceRecorder {
  const [phase, setPhase] = useState<VoiceRecorder["phase"]>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [denied, setDenied] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);

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
      void unload();
    };
  }, []);

  async function start() {
    setDenied(false);
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      setDenied(true);
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    rec.setProgressUpdateInterval(200);
    rec.setOnRecordingStatusUpdate((status) => {
      if (!status.isRecording) return;
      const ms = status.durationMillis ?? 0;
      setElapsedMs(ms);
      if (ms >= MAX_VOICE_MS) void stop(); // hard cap at 60s
    });
    recRef.current = rec;
    setElapsedMs(0);
    setPhase("recording");
    await rec.startAsync();
  }

  async function stop(): Promise<VoiceResult | null> {
    const rec = recRef.current;
    if (!rec) return null;
    recRef.current = null;
    let durationMs = elapsedMs;
    try {
      const status = await rec.stopAndUnloadAsync();
      if (typeof status.durationMillis === "number") durationMs = status.durationMillis;
    } catch {
      // fall through with the last elapsed value
    }
    const uri = rec.getURI();
    setPhase("stopped");
    if (!uri) return null;
    return { uri, mime: "audio/m4a", durationMs: Math.min(durationMs, MAX_VOICE_MS) };
  }

  async function reset() {
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
