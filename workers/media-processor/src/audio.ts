import { stat } from "node:fs/promises";
import {
  INPUT_BYTES,
  MAX_AUDIO_CHANNELS,
  MAX_AUDIO_SAMPLE_RATE,
  MAX_VOICE_DURATION_MS,
  MediaProcessingError,
  OUTPUT_BYTES,
  remainingTimeMs,
  WALL_TIME_MS,
  type ProbeResult,
  type ProbeStream,
} from "./limits.js";
import { assertSize, runProbe, runTool, sha256File } from "./photo.js";

export interface AudioOutput {
  full: { localPath: string; mimeType: "audio/mp4"; byteSize: number; sha256: string; durationMs: number };
}

export async function processAudio(inputPath: string, outputPath: string, deadlineMs = Date.now() + WALL_TIME_MS.voice): Promise<AudioOutput> {
  await assertSize(inputPath, INPUT_BYTES.voice, "TOO_LARGE");
  const inputProbe = await runProbe(inputPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
  const streams = inputProbe.streams ?? [];
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  if (audioStreams.length !== 1 || streams.some((stream) => stream.codec_type !== "audio")) {
    throw new MediaProcessingError("INVALID_MEDIA", "voice input must contain exactly one audio stream");
  }
  validateAudioStream(audioStreams[0]!);
  const inputDurationMs = trustedDurationMs(inputProbe);
  if (inputDurationMs > MAX_VOICE_DURATION_MS) throw new MediaProcessingError("TOO_LONG", "voice duration exceeds 60 seconds");

  await runTool("ffmpeg", [
    "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", inputPath, "-map", "0:a:0", "-vn", "-sn", "-dn",
    "-map_metadata", "-1", "-map_chapters", "-1", "-c:a", "aac", "-profile:a", "aac_low",
    "-ac", "2", "-ar", "48000", "-movflags", "+faststart", "-y", outputPath,
  ], remainingTimeMs(deadlineMs));
  await assertSize(outputPath, OUTPUT_BYTES.voice, "TOO_LARGE");
  const canonicalProbe = await runProbe(outputPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
  const canonicalStreams = canonicalProbe.streams ?? [];
  if (canonicalStreams.length !== 1 || canonicalStreams[0]?.codec_type !== "audio" || canonicalStreams[0]?.codec_name !== "aac") {
    throw new MediaProcessingError("PROCESSING_FAILED", "canonical voice output is not AAC-only");
  }
  validateAudioStream(canonicalStreams[0]);
  const durationMs = trustedDurationMs(canonicalProbe);
  if (durationMs > MAX_VOICE_DURATION_MS) throw new MediaProcessingError("TOO_LONG", "canonical voice duration exceeds 60 seconds");
  return {
    full: {
      localPath: outputPath,
      mimeType: "audio/mp4",
      byteSize: (await stat(outputPath)).size,
      sha256: await sha256File(outputPath),
      durationMs,
    },
  };
}

export function validateAudioStream(stream: ProbeStream): void {
  if (!Number.isInteger(stream.channels) || Number(stream.channels) < 1 || Number(stream.channels) > MAX_AUDIO_CHANNELS) {
    throw new MediaProcessingError("INVALID_MEDIA", "audio channel count is invalid");
  }
  const sampleRate = Number(stream.sample_rate);
  if (!Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > MAX_AUDIO_SAMPLE_RATE) {
    throw new MediaProcessingError("INVALID_MEDIA", "audio sample rate is invalid");
  }
}

export function trustedDurationMs(probe: ProbeResult): number {
  const durations = [probe.format?.duration, ...(probe.streams ?? []).map((stream) => stream.duration)]
    .filter((value): value is string => typeof value === "string" && value !== "N/A")
    .map((value) => Number(value) * 1_000)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (durations.length === 0) throw new MediaProcessingError("INVALID_MEDIA", "media duration is unknown");
  if (Math.max(...durations) - Math.min(...durations) > 500) {
    throw new MediaProcessingError("INVALID_MEDIA", "media duration metadata conflicts");
  }
  return Math.ceil(Math.max(...durations));
}
