import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { uniqueFiles, acceptsFile } from "../shared/workflows.mjs";
import { toolById } from "../shared/catalog.mjs";
assert.equal(
  uniqueFiles([{ path: "C:\\Files\\A.MP4" }, { path: "c:/files/a.mp4" }])
    .length,
  1,
);
assert.equal(acceptsFile(toolById["image-ocr"], { path: "scan.PNG" }), true);
assert.equal(acceptsFile(toolById["video-trim"], { path: "song.wav" }), false);
assert.equal(acceptsFile(toolById["audio-trim"], { path: "clip.mp4" }), true);
await fs.writeFile(
  "docs/verification/input-routing.json",
  JSON.stringify(
    {
      passed: true,
      windowsCaseAndSlashDeduplication: true,
      ocrImageAccepted: true,
      videoRejectsAudioOnly: true,
      audioAcceptsVideoSource: true,
    },
    null,
    2,
  ),
);
console.log("Input routing boundaries passed");
