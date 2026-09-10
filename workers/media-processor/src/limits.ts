export type MediaKind = "photo" | "voice" | "video";

export const MIB = 1024 * 1024;

export const INPUT_BYTES: Readonly<Record<MediaKind, number>> = Object.freeze({
  photo: 6 * MIB,
  voice: 8 * MIB,
  video: 40 * MIB,
});

export const OUTPUT_BYTES: Readonly<Record<MediaKind, number>> = Object.freeze({
  photo: 10 * MIB,
  voice: 10 * MIB,
  video: 50 * MIB,
});

export const WALL_TIME_MS: Readonly<Record<MediaKind, number>> = Object.freeze({
  photo: 30_000,
  voice: 45_000,
  video: 120_000,
});

export const PREVIEW_BYTES = 2 * MIB;
export const MAX_PHOTO_EDGE = 8_192;
export const MAX_PHOTO_PIXELS = 25_000_000;
export const MAX_VIDEO_WIDTH = 3_840;
export const MAX_VIDEO_HEIGHT = 2_160;
export const MAX_VIDEO_FPS = 60;
export const MAX_VIDEO_FRAMES = 1_800;
export const MAX_AUDIO_CHANNELS = 2;
export const MAX_AUDIO_SAMPLE_RATE = 48_000;
export const MAX_VOICE_DURATION_MS = 60_000;
export const MAX_VIDEO_DURATION_MS = 30_000;
export const PROBE_SIZE_BYTES = 10 * MIB;
export const ANALYZE_DURATION_MICROSECONDS = 5_000_000;
export const PROCESS_STDOUT_BYTES = 256 * 1024;

export class MediaProcessingError extends Error {
  constructor(
    readonly code:
      | "INVALID_MEDIA"
      | "PROCESSING_FAILED"
      | "TOO_LARGE"
      | "TOO_LONG"
      | "UNSUPPORTED_FORMAT",
    message: string,
  ) {
    super(message);
    this.name = "MediaProcessingError";
  }
}

export function remainingTimeMs(deadlineMs: number): number {
  const remaining = Math.floor(deadlineMs - Date.now());
  if (remaining < 1) throw new MediaProcessingError("PROCESSING_FAILED", "media processing deadline exceeded");
  return remaining;
}

export interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  nb_frames?: string;
  nb_read_frames?: string;
  duration?: string;
  channels?: number;
  sample_rate?: string;
  tags?: Record<string, string>;
}

export interface ProbeResult {
  format?: { format_name?: string; duration?: string; tags?: Record<string, string> };
  streams?: ProbeStream[];
}
