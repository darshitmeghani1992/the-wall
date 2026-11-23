/** Voice Marks are capped at 60 seconds (Master Spec §24). */
export const MAX_VOICE_MS = 60_000;

export type VoiceResult = { uri: string; mime: string; durationMs: number };

type StoppingRecording = {
  stopAndUnloadAsync: () => Promise<{ durationMillis?: number }>;
  getURI: () => string | null;
};

export async function finishVoiceCapture(
  recording: StoppingRecording,
  elapsedMs: number,
  isCurrent: () => boolean,
  onClipReady: (clip: VoiceResult) => Promise<void>,
): Promise<void> {
  let durationMs = elapsedMs;
  try {
    const status = await recording.stopAndUnloadAsync();
    if (typeof status.durationMillis === "number") durationMs = status.durationMillis;
  } catch {
    // Keep the last capture duration if the recorder cannot return its final status.
  }
  const uri = recording.getURI();
  if (uri && isCurrent()) {
    await onClipReady({ uri, mime: "audio/m4a", durationMs: Math.min(durationMs, MAX_VOICE_MS) });
  }
}
