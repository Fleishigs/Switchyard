import fs from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import assert from "node:assert/strict";
import { processTool } from "../electron/processor.mjs";
const root = path.resolve(".runtime-ai-boundaries");
await fs.mkdir(root, { recursive: true });
const input = path.join(root, "transparent.png");
await sharp({
  create: {
    width: 48,
    height: 32,
    channels: 4,
    background: { r: 100, g: 160, b: 90, alpha: 0.4 },
  },
})
  .png()
  .toFile(input);
const original = await fs.readFile(input),
  engines = { upscayl: path.resolve("engines/upscayl/upscayl-bin.exe") };
const results = [];
for (const format of ["PNG", "JPEG", "WebP"]) {
  const r = await processTool(
    {
      toolId: "image-upscale",
      files: [input],
      options: { model: "Upscayl Lite", scale: "4", format },
    },
    { engines, outputDir: path.join(root, format) },
  );
  const m = await sharp(r.outputs[0]).metadata();
  assert.equal(m.width, 192);
  assert.equal(m.height, 128);
  assert.equal(m.hasAlpha, format !== "JPEG");
  if (format !== "JPEG") {
    const a = await sharp(r.outputs[0])
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    assert.ok(a.every((n) => Math.abs(n - 102) <= 1));
  }
  results.push(format + " 4x dimensions and correct transparency");
}
await assert.rejects(
  processTool(
    { toolId: "image-upscale", files: [input] },
    { outputDir: path.join(root, "missing") },
  ),
  /not installed/,
);
results.push("Missing engine reports actionable error");
const controller = new AbortController();
controller.abort();
await assert.rejects(
  processTool(
    { toolId: "image-upscale", files: [input] },
    {
      engines,
      outputDir: path.join(root, "cancelled"),
      signal: controller.signal,
    },
  ),
  /Cancelled/,
);
results.push("Cancelled operation cannot create output");
assert.deepEqual(await fs.readFile(input), original);
results.push("Original input remains byte-identical");
await fs.writeFile(
  "docs/verification/upscayl-boundaries.json",
  JSON.stringify({ passed: results.length, results }, null, 2),
);
console.log(results);
