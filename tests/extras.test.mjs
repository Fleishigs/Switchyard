import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { processTool } from "../electron/processor.mjs";
import { parseCsv } from "../electron/extras.mjs";
test("CSV handles quoted commas, escaped quotes, CRLF and multiline fields", () => {
  assert.deepEqual(parseCsv('name,note\r\n"A, B","said ""yes""\nnext"'), [
    { name: "A, B", note: 'said "yes"\nnext' },
  ]);
  assert.throws(() => parseCsv("a,a\n1,2"));
  assert.throws(() => parseCsv('a,b\n"broken'));
});
test("local OCR reads generated English text", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "switchyard-ocr-"));
  try {
    const input = path.join(root, "input.png");
    await sharp(
      Buffer.from(
        '<svg width="1000" height="220"><rect width="100%" height="100%" fill="white"/><text x="40" y="130" font-family="Arial" font-size="64" fill="black">SWITCHYARD LOCAL OCR</text></svg>',
      ),
    )
      .png()
      .toFile(input);
    const result = await processTool(
      { toolId: "image-ocr", files: [input] },
      {
        outputDir: path.join(root, "out"),
        engines: { ocrModels: path.resolve("engines/ocr") },
      },
    );
    assert.match(result.text, /SWITCHYARD LOCAL OCR/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("converters reject impossible dates, temperatures and invalid digits", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "switchyard-values-"));
  try {
    for (const [toolId, options] of [
      ["date-distance", { from: "2026-02-30" }],
      ["unit-temperature", { value: -300 }],
      ["number-base", { value: "102", base: "2" }],
    ])
      await assert.rejects(
        processTool({ toolId, options }, { outputDir: root }),
      );
    const r = await processTool(
      { toolId: "unit-length", options: { value: 1, unit: "inches" } },
      { outputDir: root },
    );
    assert.equal(JSON.parse(r.text).meters, 0.0254);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
