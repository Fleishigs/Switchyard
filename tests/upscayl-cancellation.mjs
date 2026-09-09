import fs from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import assert from "node:assert/strict";
import { processTool } from "../electron/processor.mjs";
const root = path.resolve(".runtime-ai-cancel-" + Date.now());
await fs.mkdir(root, { recursive: true });
const input = path.join(root, "source.png");
await sharp({
  create: { width: 512, height: 512, channels: 3, background: "#347766" },
})
  .png()
  .toFile(input);
const c = new AbortController();
let invoked = false;
const out = path.join(root, "output");
await assert.rejects(
  processTool(
    {
      toolId: "image-upscale",
      files: [input],
      options: { model: "Upscayl Standard", scale: "4", format: "PNG" },
    },
    {
      engines: { upscayl: path.resolve("engines/upscayl/upscayl-bin.exe") },
      outputDir: out,
      signal: c.signal,
      onLog: (line) => {
        if (line.includes("queueC")) {
          invoked = true;
          c.abort();
        }
      },
    },
  ),
  /Cancelled/,
);
assert.ok(invoked);
assert.deepEqual(await fs.readdir(out), []);
await fs.writeFile(
  "docs/verification/upscayl-cancellation.json",
  JSON.stringify(
    {
      passed: true,
      actualGpuProcessStarted: true,
      temporaryFilesRemoved: true,
    },
    null,
    2,
  ),
);
console.log("Actual GPU process cancelled; temporary files removed");
