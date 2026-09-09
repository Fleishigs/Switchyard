import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { processTool } from "../electron/processor.mjs";
const root = path.resolve(".runtime-upscayl");
await fs.mkdir(root, { recursive: true });
const input = path.join(root, "fixture.png");
await sharp(
  Buffer.from(
    '<svg width="160" height="120"><rect width="160" height="120" fill="#406680"/><circle cx="65" cy="60" r="35" fill="#edb055"/><text x="20" y="75" font-size="22">DETAIL</text></svg>',
  ),
)
  .png()
  .toFile(input);
const reports = [];
for (const model of ["Upscayl Lite", "Upscayl Standard", "Digital Art"]) {
  const out = path.join(root, model);
  const started = Date.now();
  let log = "";
  const result = await processTool(
    {
      toolId: "image-upscale",
      files: [input],
      options: { model, scale: "2", format: "PNG" },
    },
    {
      outputDir: out,
      engines: { upscayl: path.resolve("engines/upscayl/upscayl-bin.exe") },
      onLog: (s) => {
        log += s;
      },
    },
  );
  const image = await sharp(result.outputs[0])
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    baseline = await sharp(input)
      .resize(320, 240)
      .removeAlpha()
      .raw()
      .toBuffer();
  assert.equal(image.info.width, 320);
  assert.equal(image.info.height, 240);
  assert.equal(image.data.length, baseline.length);
  assert.notDeepEqual(image.data, baseline);
  reports.push({
    model,
    milliseconds: Date.now() - started,
    dimensions: [image.info.width, image.info.height],
    neuralOutputDiffersFromResize: true,
    log,
  });
  console.log(model, Date.now() - started);
}
await fs.writeFile(
  "docs/verification/upscayl-outcomes.json",
  JSON.stringify(reports, null, 2),
);
