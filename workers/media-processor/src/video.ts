import { stat } from "node:fs/promises";
import {
  INPUT_BYTES,
  MAX_VIDEO_DURATION_MS,
  MAX_VIDEO_FPS,
  MAX_VIDEO_FRAMES,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
  MediaProcessingError,
  OUTPUT_BYTES,
  PREVIEW_BYTES,
  remainingTimeMs,
  WALL_TIME_MS,
} from "./limits.js";
import { trustedDurationMs, validateAudioStream } from "./audio.js";
import { assertSize, runProbe, runTool, sha256File } from "./photo.js";

export interface VideoOutput {
  full: { localPath: string; mimeType: "video/mp4"; byteSize: number; sha256: string; width: number; height: number; durationMs: number };
  preview?: { localPath: string; mimeType: "image/webp"; byteSize: number; sha256: string; width: number; height: number };
}

export async function processVideo(
  inputPath: string,
  outputPath: string,
  posterPath?: string,
  deadlineMs = Date.now() + WALL_TIME_MS.video,
): Promise<VideoOutput> {
  await assertSize(inputPath, INPUT_BYTES.video, "TOO_LARGE");
  const probe = await runProbe(inputPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
  const streams = probe.streams ?? [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  if (videoStreams.length !== 1 || audioStreams.length > 1 || streams.some((stream) => stream.codec_type !== "video" && stream.codec_type !== "audio")) {
    throw new MediaProcessingError("INVALID_MEDIA", "video stream layout is invalid");
  }
  if (audioStreams[0]) validateAudioStream(audioStreams[0]);
  const video = videoStreams[0]!;
  const width = Number(video.width);
  const height = Number(video.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_VIDEO_WIDTH || height > MAX_VIDEO_HEIGHT) {
    throw new MediaProcessingError("TOO_LARGE", "video dimensions exceed limits");
  }
  const fps = parseFrameRate(video.avg_frame_rate ?? video.r_frame_rate);
  if (fps <= 0 || fps > MAX_VIDEO_FPS) throw new MediaProcessingError("INVALID_MEDIA", "video frame rate is invalid");
  const durationMs = trustedDurationMs(probe);
  if (durationMs > MAX_VIDEO_DURATION_MS) throw new MediaProcessingError("TOO_LONG", "video duration exceeds 30 seconds");
  const countedFrames = parseFrameCount(video.nb_read_frames ?? video.nb_frames);
  const estimatedFrames = Math.ceil((durationMs / 1_000) * fps);
  if ((countedFrames ?? estimatedFrames) > MAX_VIDEO_FRAMES || estimatedFrames > MAX_VIDEO_FRAMES + 1) {
    throw new MediaProcessingError("INVALID_MEDIA", "video frame count exceeds limits");
  }

  await runTool("ffmpeg", [
    "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", inputPath, "-map", "0:v:0", "-map", "0:a:0?",
    "-map_metadata", "-1", "-map_chapters", "-1", "-sn", "-dn",
    "-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-profile:a", "aac_low", "-ac", "2", "-ar", "48000",
    "-movflags", "+faststart", "-y", outputPath,
  ], remainingTimeMs(deadlineMs));
  await assertSize(outputPath, OUTPUT_BYTES.video, "TOO_LARGE");
  const canonical = await inspectCanonicalVideo(outputPath, deadlineMs);

  const result: VideoOutput = {
    full: {
      localPath: outputPath,
      mimeType: "video/mp4",
      byteSize: (await stat(outputPath)).size,
      sha256: await sha256File(outputPath),
      ...canonical,
    },
  };
  if (posterPath) {
    await runTool("ffmpeg", [
      "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", outputPath, "-frames:v", "1", "-vf",
      "scale=w='min(512,iw)':h='min(512,ih)':force_original_aspect_ratio=decrease",
      "-map_metadata", "-1", "-an", "-sn", "-dn", "-c:v", "libwebp", "-q:v", "80", "-y", posterPath,
    ], remainingTimeMs(deadlineMs));
    await assertSize(posterPath, PREVIEW_BYTES, "TOO_LARGE");
    const posterProbe = await runProbe(posterPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
    const poster = posterProbe.streams?.find((stream) => stream.codec_type === "video");
    if (!poster?.width || !poster.height) throw new MediaProcessingError("PROCESSING_FAILED", "video poster probe failed");
    result.preview = {
      localPath: posterPath,
      mimeType: "image/webp",
      byteSize: (await stat(posterPath)).size,
      sha256: await sha256File(posterPath),
      width: poster.width,
      height: poster.height,
    };
  }
  return result;
}

async function inspectCanonicalVideo(path: string, deadlineMs: number): Promise<{ width: number; height: number; durationMs: number }> {
  const probe = await runProbe(path, Math.min(5_000, remainingTimeMs(deadlineMs)));
  const streams = probe.streams ?? [];
  const video = streams.filter((stream) => stream.codec_type === "video");
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  if (video.length !== 1 || video[0]?.codec_name !== "h264" || audio.length > 1 ||
      audio.some((stream) => stream.codec_name !== "aac") ||
      streams.some((stream) => stream.codec_type !== "video" && stream.codec_type !== "audio")) {
    throw new MediaProcessingError("PROCESSING_FAILED", "canonical video stream layout is invalid");
  }
  if (audio[0]) validateAudioStream(audio[0]);
  const durationMs = trustedDurationMs(probe);
  if (durationMs > MAX_VIDEO_DURATION_MS) throw new MediaProcessingError("TOO_LONG", "canonical video duration exceeds 30 seconds");
  if (!video[0]?.width || !video[0].height) throw new MediaProcessingError("PROCESSING_FAILED", "canonical video dimensions are invalid");
  return { width: video[0].width, height: video[0].height, durationMs };
}

function parseFrameRate(value: string | undefined): number {
  if (!value) return NaN;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return NaN;
  return numerator! / denominator!;
}

function parseFrameCount(value: string | undefined): number | null {
  if (!value || value === "N/A") return null;
  const result = Number(value);
  return Number.isInteger(result) && result > 0 ? result : null;
}
