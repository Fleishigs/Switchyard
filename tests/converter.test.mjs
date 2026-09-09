import { DatabaseSync } from "node:sqlite";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { processTool, command } from "../electron/processor.mjs";
import { families, formatInfo } from "../shared/formats.mjs";
let root;
const inputs = {};
const engines = {
  separator: path.resolve("engines/separator/python.exe"),
  ffmpeg: path.resolve("engines/ffmpeg/ffmpeg.exe"),
  pandoc: path.resolve("engines/pandoc/pandoc.exe"),
  office: path.resolve("engines/office/program/soffice.com"),
  sevenz: path.resolve("engines/7zip/7z.exe"),
};
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "switchyard-conversion-"));
  inputs.image = path.join(root, "source.png");
  await sharp({
    create: { width: 320, height: 240, channels: 3, background: "#558866" },
  })
    .png()
    .toFile(inputs.image);
  inputs.audio = path.join(root, "source.wav");
  await command(engines.ffmpeg, [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    inputs.audio,
  ]);
  inputs.video = path.join(root, "source.mp4");
  await command(engines.ffmpeg, [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=green:s=320x240:d=1",
    "-i",
    inputs.audio,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    inputs.video,
  ]);
  inputs.document = path.join(root, "source.md");
  await fs.writeFile(
    inputs.document,
    "# Switchyard\n\nA real document conversion.\n\n- First item\n- Second item\n",
  );
  inputs.spreadsheet = path.join(root, "source.csv");
  await fs.writeFile(
    inputs.spreadsheet,
    "Name,Value\nSwitchyard,42\nWorkshop,17",
  );
  inputs.pdf = path.join(root, "source.pdf");
  const doc = await PDFDocument.create();
  doc.addPage().drawText("Switchyard PDF conversion", { x: 30, y: 300 });
  await fs.writeFile(inputs.pdf, await doc.save());
  inputs.data = path.join(root, "source.json");
  await fs.writeFile(inputs.data, '[{"name":"Switchyard","value":42}]');
  const archiveInput = path.join(root, "archive-input");
  await fs.mkdir(archiveInput);
  await fs.writeFile(
    path.join(archiveInput, "hello.txt"),
    "Switchyard archive test",
  );
  inputs.archive = path.join(root, "source.zip");
  await command(engines.sevenz, ["a", inputs.archive, "."], {
    cwd: archiveInput,
  });
  inputs.font = path.join(root, "source.ttf");
  await fs.copyFile("C:/Windows/Fonts/arial.ttf", inputs.font);
  inputs.mesh = path.join(root, "source.stl");
  await command(engines.separator, [
    "-c",
    "import trimesh,sys; trimesh.creation.box().export(sys.argv[1])",
    inputs.mesh,
  ]);
  inputs.subtitle = path.join(root, "source.srt");
  await fs.writeFile(
    inputs.subtitle,
    "1\n00:00:00,000 --> 00:00:01,000\nSwitchyard subtitles\n",
  );
  inputs.database = path.join(root, "source.sqlite");
  const db = new DatabaseSync(inputs.database);
  db.exec(
    "CREATE TABLE example (name TEXT, value INTEGER); INSERT INTO example VALUES ('Switchyard',42)",
  );
  db.close();
  inputs.presentation = path.join(root, "source.pptx");
  await command(engines.pandoc, [
    "--sandbox",
    inputs.document,
    "-o",
    inputs.presentation,
  ]);
  const docx = path.join(root, "source.docx");
  await command(engines.pandoc, ["--sandbox", inputs.document, "-o", docx]);
  inputs.officeDoc = docx;
});
after(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
});
for (const [family, config] of Object.entries(families))
  for (const target of config.outputs.split(" "))
    test(`batch ${family} → ${target}`, async () => {
      const file = inputs[family],
        outputDir = path.join(root, family + "-" + target);
      const result = await processTool(
        {
          toolId: "batch-convert",
          files: [file],
          options: { targets: { [file]: target } },
        },
        { outputDir, engines },
      );
      assert.equal(result.failures, 0, result.text);
      assert.ok(result.outputs.length >= 2);
      for (const p of result.outputs) assert.ok((await fs.stat(p)).size > 0);
    });
test("Office document conversion and mixed-batch error isolation", async () => {
  const unknown = path.join(root, "source.unknown");
  await fs.writeFile(unknown, "unknown");
  const files = [inputs.officeDoc, inputs.image, unknown],
    result = await processTool(
      {
        toolId: "batch-convert",
        files,
        options: {
          targets: { [inputs.officeDoc]: "pdf", [inputs.image]: "webp" },
        },
      },
      { outputDir: path.join(root, "mixed"), engines },
    );
  assert.equal(result.failures, 1, result.text);
  assert.equal(result.outputs.length, 3);
  assert.match(result.text, /ERROR/);
});
test("rejects unsupported destinations without claiming conversion", async () => {
  const file = inputs.image;
  const r = await processTool(
    {
      toolId: "batch-convert",
      files: [file],
      options: { targets: { [file]: "exe" } },
    },
    { outputDir: path.join(root, "invalid"), engines },
  );
  assert.equal(r.failures, 1);
  assert.equal(r.outputs.length, 1);
});
test("format lookup recognizes case and unsupported extensions", () => {
  assert.equal(formatInfo("PHOTO.JPG").family, "image");
  assert.equal(formatInfo("app.exe").family, null);
});
