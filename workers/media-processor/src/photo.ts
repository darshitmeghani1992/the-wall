import { createHash } from "node:crypto";
import { open, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  INPUT_BYTES,
  MAX_PHOTO_EDGE,
  MAX_PHOTO_PIXELS,
  MediaProcessingError,
  OUTPUT_BYTES,
  PREVIEW_BYTES,
  PROCESS_STDOUT_BYTES,
  remainingTimeMs,
  WALL_TIME_MS,
  type ProbeResult,
} from "./limits.js";

export interface PhotoOutput {
  full: { localPath: string; mimeType: "image/jpeg" | "image/webp"; byteSize: number; sha256: string; width: number; height: number };
  preview?: { localPath: string; mimeType: "image/webp"; byteSize: number; sha256: string; width: number; height: number };
}

export async function processPhoto(
  inputPath: string,
  jpegOutputPath: string,
  webpOutputPath: string,
  previewOutputPath?: string,
  deadlineMs = Date.now() + WALL_TIME_MS.photo,
): Promise<PhotoOutput> {
  await assertSize(inputPath, INPUT_BYTES.photo, "TOO_LARGE");
  const container = await inspectPhotoContainer(inputPath);
  const probe = await runProbe(inputPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
  const videoStreams = (probe.streams ?? []).filter((stream) => stream.codec_type === "video");
  if (videoStreams.length !== 1 || (probe.streams ?? []).some((stream) => stream.codec_type !== "video")) {
    throw new MediaProcessingError("INVALID_MEDIA", "photo must contain exactly one image stream");
  }
  const stream = videoStreams[0];
  if (!stream || !Number.isInteger(stream.width) || !Number.isInteger(stream.height)) {
    throw new MediaProcessingError("INVALID_MEDIA", "photo dimensions are unavailable");
  }
  const width = Number(stream.width);
  const height = Number(stream.height);
  if (width < 1 || height < 1 || width > MAX_PHOTO_EDGE || height > MAX_PHOTO_EDGE || width * height > MAX_PHOTO_PIXELS) {
    throw new MediaProcessingError("TOO_LARGE", "photo dimensions exceed limits");
  }
  const frames = parsePositiveInteger(stream.nb_read_frames ?? stream.nb_frames ?? "1");
  if (frames !== 1) throw new MediaProcessingError("UNSUPPORTED_FORMAT", "animated or multi-frame photos are rejected");

  const preserveAlpha = hasAlphaChannel(stream.pix_fmt);
  const fullMime = preserveAlpha ? "image/webp" as const : "image/jpeg" as const;
  const fullOutputPath = preserveAlpha ? webpOutputPath : jpegOutputPath;
  const fullArgs = ["-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", inputPath, "-map_metadata", "-1", "-map_chapters", "-1", "-frames:v", "1", "-an", "-sn", "-dn"];
  if (preserveAlpha) fullArgs.push("-c:v", "libwebp", "-lossless", "1", "-pix_fmt", "yuva420p");
  else fullArgs.push("-c:v", "mjpeg", "-q:v", "2", "-pix_fmt", "yuvj420p");
  fullArgs.push("-y", fullOutputPath);
  await runTool("ffmpeg", fullArgs, remainingTimeMs(deadlineMs));
  await assertSize(fullOutputPath, OUTPUT_BYTES.photo, "TOO_LARGE");
  const canonicalProbe = await runProbe(fullOutputPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
  const canonicalStream = canonicalProbe.streams?.find((item) => item.codec_type === "video");
  if (!canonicalStream?.width || !canonicalStream.height) throw new MediaProcessingError("PROCESSING_FAILED", "canonical photo probe failed");

  const result: PhotoOutput = {
    full: {
      localPath: fullOutputPath,
      mimeType: fullMime,
      byteSize: (await stat(fullOutputPath)).size,
      sha256: await sha256File(fullOutputPath),
      width: canonicalStream.width,
      height: canonicalStream.height,
    },
  };
  if (previewOutputPath) {
    await runTool("ffmpeg", [
      "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", inputPath, "-map_metadata", "-1", "-map_chapters", "-1",
      "-frames:v", "1", "-vf", "scale=w='min(512,iw)':h='min(512,ih)':force_original_aspect_ratio=decrease",
      "-an", "-sn", "-dn", "-c:v", "libwebp", "-q:v", "80", "-y", previewOutputPath,
    ], remainingTimeMs(deadlineMs));
    await assertSize(previewOutputPath, PREVIEW_BYTES, "TOO_LARGE");
    const previewProbe = await runProbe(previewOutputPath, Math.min(5_000, remainingTimeMs(deadlineMs)));
    const previewStream = previewProbe.streams?.find((item) => item.codec_type === "video");
    if (!previewStream?.width || !previewStream.height) throw new MediaProcessingError("PROCESSING_FAILED", "photo preview probe failed");
    result.preview = {
      localPath: previewOutputPath,
      mimeType: "image/webp",
      byteSize: (await stat(previewOutputPath)).size,
      sha256: await sha256File(previewOutputPath),
      width: previewStream.width,
      height: previewStream.height,
    };
  }
  return result;
}

async function inspectPhotoContainer(path: string): Promise<"jpeg" | "png" | "webp"> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    const header = Buffer.alloc(Math.min(size, 16));
    await handle.read(header, 0, header.length, 0);
    if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      if (!(await hasExactPngEnd(handle, size))) throw new MediaProcessingError("INVALID_MEDIA", "PNG has trailing or missing data");
      return "png";
    }
    if (header.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) {
      assertExactJpegStructure(await readFile(path));
      return "jpeg";
    }
    if (header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") {
      if (header.readUInt32LE(4) + 8 !== size) throw new MediaProcessingError("INVALID_MEDIA", "WebP container length is invalid");
      return "webp";
    }
    throw new MediaProcessingError("UNSUPPORTED_FORMAT", "photo magic bytes are not supported");
  } finally {
    await handle.close();
  }
}

function assertExactJpegStructure(bytes: Buffer): void {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new MediaProcessingError("INVALID_MEDIA", "JPEG marker structure is invalid");
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) throw new MediaProcessingError("INVALID_MEDIA", "JPEG marker is truncated");
    const marker = bytes[offset++]!;
    if (marker === 0xd9) {
      if (offset !== bytes.length) throw new MediaProcessingError("INVALID_MEDIA", "JPEG contains trailing data after EOI");
      return;
    }
    if (marker === 0xd8 || marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      throw new MediaProcessingError("INVALID_MEDIA", "JPEG contains an unexpected standalone marker");
    }
    if (offset + 2 > bytes.length) throw new MediaProcessingError("INVALID_MEDIA", "JPEG segment length is truncated");
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) throw new MediaProcessingError("INVALID_MEDIA", "JPEG segment length is invalid");
    offset += segmentLength;
    if (marker !== 0xda) continue;

    // Entropy-coded scan bytes may contain stuffed FF00 and restart markers.
    // The next unstuffed non-restart marker resumes outer marker parsing.
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const markerStart = offset;
      while (bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) throw new MediaProcessingError("INVALID_MEDIA", "JPEG scan is truncated");
      const scanMarker = bytes[offset]!;
      if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
        offset += 1;
        continue;
      }
      offset = markerStart;
      break;
    }
  }
  throw new MediaProcessingError("INVALID_MEDIA", "JPEG has no terminal EOI marker");
}

async function hasExactPngEnd(handle: Awaited<ReturnType<typeof open>>, size: number): Promise<boolean> {
  if (size < 20) return false;
  const tail = Buffer.alloc(12);
  await handle.read(tail, 0, 12, size - 12);
  return tail.readUInt32BE(0) === 0 && tail.subarray(4, 8).toString("ascii") === "IEND";
}

export async function runProbe(path: string, timeoutMs: number): Promise<ProbeResult> {
  const stdout = await runTool("ffprobe", [
    "-v", "error", "-protocol_whitelist", "file,pipe", "-probesize", "10485760", "-analyzeduration", "5000000", "-count_frames",
    "-show_entries", "format=format_name,duration:format_tags:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,r_frame_rate,nb_frames,nb_read_frames,duration,channels,sample_rate:stream_tags",
    "-of", "json", path,
  ], Math.min(timeoutMs, 5_000));
  try {
    return JSON.parse(stdout) as ProbeResult;
  } catch {
    throw new MediaProcessingError("INVALID_MEDIA", "ffprobe returned invalid JSON");
  }
}

export async function runTool(command: string, args: string[], timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    let stdoutSize = 0;
    let stdoutExceeded = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, Math.max(1, timeoutMs));
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutSize += chunk.length;
      if (stdoutSize > PROCESS_STDOUT_BYTES) {
        stdoutExceeded = true;
        child.kill("SIGKILL");
      } else {
        stdout.push(chunk);
      }
    });
    // Drain but never retain or expose decoder diagnostics: malicious media can
    // cause tool output to contain embedded private/sentinel bytes.
    child.stderr.resume();
    child.once("error", () => { clearTimeout(timer); reject(new MediaProcessingError("PROCESSING_FAILED", "media tool could not start")); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new MediaProcessingError("PROCESSING_FAILED", "media tool exceeded its time limit"));
      else if (stdoutExceeded) reject(new MediaProcessingError("PROCESSING_FAILED", "media tool output exceeded its diagnostic limit"));
      else if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
      else reject(new MediaProcessingError("PROCESSING_FAILED", "media tool exited unsuccessfully"));
    });
  });
}

export async function assertSize(path: string, maximum: number, code: "TOO_LARGE"): Promise<void> {
  const size = (await stat(path)).size;
  if (size < 1 || size > maximum) throw new MediaProcessingError(code, "media byte size is outside the accepted range");
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function hasAlphaChannel(pixelFormat: string | undefined): boolean {
  if (!pixelFormat) return false;
  return /^(?:rgba|bgra|argb|abgr)|yuva|gbrap|pal8/.test(pixelFormat);
}
