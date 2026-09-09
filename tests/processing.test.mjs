import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  tools,
  defaults,
  validateOptions,
  searchTools,
} from "../shared/catalog.mjs";
import { processTool, command } from "../electron/processor.mjs";
import { textFixture } from "./fixtures.mjs";
let root, image, audio, video, pdf;
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "switchyard-test-"));
  image = path.join(root, "source.png");
  audio = path.join(root, "source.wav");
  video = path.join(root, "source.mp4");
  pdf = path.join(root, "source.pdf");
  await sharp({
    create: { width: 1920, height: 1440, channels: 3, background: "#597f60" },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 1000,
            height: 700,
            channels: 3,
            background: "#e4dab0",
          },
        })
          .png()
          .toBuffer(),
        left: 100,
        top: 100,
      },
    ])
    .png()
    .toFile(image);
  await command("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=3",
    "-ac",
    "2",
    audio,
  ]);
  await command("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x240:rate=12:duration=3",
    "-i",
    audio,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    video,
  ]);
  const d = await PDFDocument.create();
  d.addPage([300, 400]).drawText("Switchyard document test", {
    x: 20,
    y: 300,
    size: 14,
  });
  d.addPage([500, 600]);
  await fs.writeFile(pdf, await d.save());
});
after(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
});
for (const tool of tools.filter(
  (t) => !["download", "engine", "batch", "ocr"].includes(t.kind),
))
  test(`${tool.id}: produces a real output`, async () => {
    let files =
      tool.kind === "image"
        ? [image]
        : tool.kind === "audio"
          ? [audio]
          : tool.kind === "video"
            ? [video]
            : tool.kind === "pdf"
              ? tool.id === "pdf-images"
                ? [image]
                : [pdf]
              : [];
    const text = textFixture(tool.id);
    const result = await processTool(
      { toolId: tool.id, files, text, options: defaults(tool) },
      {
        outputDir: path.join(root, tool.id),
        engines: { upscayl: path.resolve("engines/upscayl/upscayl-bin.exe") },
      },
    );
    assert.ok(result.outputs.length > 0);
    for (const output of result.outputs)
      assert.ok((await fs.stat(output)).size > 0);
    if (tool.id === "image-resize") {
      const meta = await sharp(result.outputs[0]).metadata();
      assert.equal(meta.width, 1600);
      assert.equal(meta.height, 1200);
    }
    if (tool.id === "image-crop") {
      const meta = await sharp(result.outputs[0]).metadata();
      assert.equal(meta.width, 1600);
    }
    if (tool.id === "pdf-reverse") {
      const d = await PDFDocument.load(await fs.readFile(result.outputs[0]));
      assert.equal(d.getPage(0).getWidth(), 500);
    }
    if (tool.id === "pdf-rotate") {
      const d = await PDFDocument.load(await fs.readFile(result.outputs[0]));
      assert.equal(d.getPage(0).getRotation().angle, 90);
    }
    if (tool.id === "audio-mono") {
      const data = JSON.parse(
        await command("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          result.outputs[0],
        ]),
      );
      assert.equal(data.streams[0].channels, 1);
    }
    if (tool.id === "video-mute") {
      const data = JSON.parse(
        await command("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          result.outputs[0],
        ]),
      );
      assert.equal(
        data.streams.some((s) => s.codec_type === "audio"),
        false,
      );
    }
    if (tool.id === "text-unbase64") assert.equal(result.text, "Hello");
  });
test("registry is unique and all defaults validate", () => {
  assert.equal(new Set(tools.map((t) => t.id)).size, tools.length);
  for (const t of tools) validateOptions(t, defaults(t));
});
test("search finds the right family", () =>
  assert.ok(
    searchTools("crop image")
      .slice(0, 5)
      .some((t) => t.id === "image-crop"),
  ));
test("rejects invalid input and missing optional engines", async () => {
  for (const request of [
    { toolId: "missing" },
    { toolId: "image-resize", files: [] },
    { toolId: "image-crop", files: [image], options: { width: -1 } },
    { toolId: "text-json", text: "broken" },
    { toolId: "text-unbase64", text: "!" },
    { toolId: "voice-transcribe", files: [audio] },
    { toolId: "voice-vocals", files: [audio] },
    { toolId: "download-video", options: { url: "file:///C:/hello" } },
  ])
    await assert.rejects(
      processTool(request, { outputDir: path.join(root, "invalid") }),
    );
});
test("cancels a running child process", async () => {
  const c = new AbortController();
  const run = command(process.execPath, ["-e", "setTimeout(()=>{},30000)"], {
    signal: c.signal,
  });
  setTimeout(() => c.abort(), 100);
  await assert.rejects(run, /Cancelled/);
});
test("does not touch original input files", async () =>
  assert.equal((await sharp(image).metadata()).width, 1920));
