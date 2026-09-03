import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { processAudio } from "../src/audio.js";
import { MediaProcessingError } from "../src/limits.js";
import { processPhoto, runProbe, runTool } from "../src/photo.js";
import { processVideo } from "../src/video.js";

async function withWorkspace(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "media-worker-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("photo is fully decoded, re-encoded, metadata-stripped and full-frame", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "source.png");
    const full = join(directory, "full.jpg");
    const alternate = join(directory, "full.webp");
    const thumb = join(directory, "thumb.webp");
    await runTool("ffmpeg", [
      "-f", "lavfi", "-i", "color=c=red:s=64x32:d=0.1", "-frames:v", "1",
      "-metadata", "comment=private-gps-like-value", "-y", source,
    ], 5_000);
    const result = await processPhoto(source, full, alternate, thumb);
    assert.equal(result.full.width / result.full.height, 2);
    assert.equal(result.preview?.width, 64, "thumbnail must not upscale");
    assert.equal(result.preview?.height, 32);
    assert.match(result.full.sha256, /^[0-9a-f]{64}$/);
    const probe = await runProbe(full, 5_000);
    assert.equal(JSON.stringify(probe).includes("private-gps-like-value"), false);
  });
});

test("photo rejects trailing polyglot bytes", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "source.jpg");
    await runTool("ffmpeg", ["-f", "lavfi", "-i", "color=c=blue:s=32x32", "-frames:v", "1", "-y", source], 5_000);
    await appendFile(source, Buffer.concat([Buffer.from("PK\u0003\u0004hidden-archive"), Buffer.from([0xff, 0xd9])]));
    await assert.rejects(processPhoto(source, join(directory, "full.jpg"), join(directory, "full.webp")), (error: unknown) =>
      error instanceof MediaProcessingError && error.code === "INVALID_MEDIA");
  });
});

test("photo selects the exact WebP candidate when decoded alpha is required", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "alpha.png");
    const jpeg = join(directory, "full.jpg");
    const webp = join(directory, "full.webp");
    await runTool("ffmpeg", [
      "-f", "lavfi", "-i", "color=c=red@0.5:s=32x16,format=rgba", "-frames:v", "1", "-y", source,
    ], 5_000);
    const result = await processPhoto(source, jpeg, webp);
    assert.equal(result.full.mimeType, "image/webp");
    assert.equal(result.full.localPath, webp);
    assert.equal(result.full.width / result.full.height, 2);
  });
});

test("voice becomes metadata-free AAC/M4A with trusted duration", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "voice.wav");
    const output = join(directory, "voice.m4a");
    await runTool("ffmpeg", ["-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-metadata", "title=private", "-y", source], 5_000);
    const result = await processAudio(source, output);
    assert.equal(result.full.mimeType, "audio/mp4");
    assert.ok(result.full.durationMs >= 900 && result.full.durationMs <= 1_100);
    const probe = await runProbe(output, 5_000);
    assert.equal(probe.streams?.length, 1);
    assert.equal(probe.streams?.[0]?.codec_name, "aac");
    assert.equal(JSON.stringify(probe).includes("private"), false);
  });
});

test("voice rejects a container with a video stream", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "not-voice.mp4");
    await runTool("ffmpeg", ["-f", "lavfi", "-i", "color=s=32x32:d=1", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", "-y", source], 10_000);
    await assert.rejects(processAudio(source, join(directory, "voice.m4a")), (error: unknown) =>
      error instanceof MediaProcessingError && error.code === "INVALID_MEDIA");
  });
});

test("decoder refuses media that tries to fetch a nested network URL", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "playlist.m3u8");
    await writeFile(source, "#EXTM3U\n#EXTINF:1,\nhttps://169.254.169.254/latest/meta-data\n", { mode: 0o600 });
    await assert.rejects(processAudio(source, join(directory, "voice.m4a")), (error: unknown) =>
      error instanceof MediaProcessingError && error.code === "PROCESSING_FAILED");
  });
});

test("video becomes H.264/AAC MP4, preserves aspect and emits a bounded poster", async () => {
  await withWorkspace(async (directory) => {
    const source = join(directory, "source.mp4");
    const output = join(directory, "output.mp4");
    const poster = join(directory, "poster.webp");
    await runTool("ffmpeg", [
      "-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=1", "-f", "lavfi", "-i", "sine=duration=1",
      "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-metadata", "title=private", "-y", source,
    ], 15_000);
    const result = await processVideo(source, output, poster);
    assert.equal(result.full.width / result.full.height, 320 / 180);
    assert.ok(result.full.durationMs <= 1_100);
    assert.ok((result.preview?.byteSize ?? Infinity) < 2 * 1024 * 1024);
    const bytes = await readFile(output);
    assert.equal(bytes.includes(Buffer.from("private")), false);
  });
});

test("subprocess timeout, stdout cap, and tool exit are safe PROCESSING_FAILED errors", async () => {
  const sentinel = "PRIVATE_STDERR_SENTINEL_83f6";
  const failures = [
    () => runTool(process.execPath, ["-e", "setInterval(() => {}, 1000)"], 20),
    () => runTool(process.execPath, ["-e", "process.stdout.write('x'.repeat(300000))"], 1_000),
    () => runTool(process.execPath, ["-e", `process.stderr.write('${sentinel}'); process.exit(7)`], 1_000),
  ];
  for (const failure of failures) {
    await assert.rejects(failure(), (error: unknown) => {
      assert.ok(error instanceof MediaProcessingError);
      assert.equal(error.code, "PROCESSING_FAILED");
      assert.equal(error.message.includes(sentinel), false, "raw subprocess stderr must never escape");
      return true;
    });
  }
});
