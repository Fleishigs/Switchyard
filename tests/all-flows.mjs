import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { tools } from "../shared/catalog.mjs";
import {textFixture} from './fixtures.mjs';
import { command } from "../electron/processor.mjs";
const root = path.resolve("."),
  runtime = path.join(root, ".runtime-flows-" + Date.now()),
  report = path.join(root, "docs/verification");
await fs.mkdir(runtime, { recursive: true });
await fs.mkdir(report, { recursive: true });
const image = path.join(runtime, "test image.png"),
  audio = path.join(runtime, "test audio.wav"),
  video = path.join(runtime, "test video.mp4"),
  pdf = path.join(runtime, "test document.pdf");
await sharp({
  create: { width: 1920, height: 1440, channels: 3, background: "#466e58" },
})
  .composite([
    {
      input: await sharp({
        create: { width: 500, height: 500, channels: 3, background: "#e0dfac" },
      })
        .png()
        .toBuffer(),
      left: 60,
      top: 60,
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
const doc = await PDFDocument.create();
doc.addPage().drawText('Switchyard PDF flow',{x:30,y:400});
doc.addPage();
await fs.writeFile(pdf, await doc.save());
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(runtime, "data"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath:
    process.env.SWITCHYARD_TEST_EXE ||
    path.join(root, "node_modules/electron/dist/electron.exe"),
  args: [
    ...(process.env.SWITCHYARD_TEST_EXE ? [] : [root]),
    "--disable-gpu",
    "--mute-audio",
  ],
  env,
  timeout: 60000,
});
const results = [],
  errors = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Switchyard home" }).waitFor();
  for (const tool of tools.filter(
    (t) => !["download", "engine", "batch", "ocr"].includes(t.kind),
  )) {
    if (
      await page
        .getByRole("button", { name: "Clear tray", exact: true })
        .count()
    )
      await page
        .getByRole("button", { name: "Clear tray", exact: true })
        .click();
    const file =
      tool.kind === "image"
        ? image
        : tool.kind === "audio"
          ? audio
          : tool.kind === "video"
            ? video
            : tool.kind === "pdf"
              ? tool.id === "pdf-images"
                ? image
                : pdf
              : null;
    if (file) {
      await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      }, file);
      await page
        .getByRole("button", { name: "Add files", exact: true })
        .first()
        .click();
    }
    await page.getByRole("textbox", { name: "Search tools" }).fill(tool.name);
    await page
      .locator(".tool-open")
      .filter({
        has: page.getByRole("heading", { name: tool.name, exact: true }),
      })
      .click();
    if (tool.kind === "text") {
      const value=textFixture(tool.id);
      await page.getByRole("textbox", { name: "Input text" }).fill(value);
    }
    await page.getByRole("button", { name: "Run tool", exact: true }).click();
    await page.waitForFunction(
      () => {
        const p = document.querySelector(".job-top p");
        return p && / · (done|error|cancelled)$/.test(p.textContent);
      },
      {},
      { timeout: 120000 },
    );
    const job = await page.evaluate(
      async () => (await window.switchyard.state()).jobs[0],
    );
    assert.equal(job.status, "done", `${tool.id}: ${job.error}`);
    for (const p of job.outputs) assert.ok((await fs.stat(p)).size > 0);
    results.push({ tool: tool.id, pass: true, outputs: job.outputs.length });
    console.log("PASS " + tool.id);
  }
  // End-to-end error, then recovery using the same form.
  await page.getByRole("textbox", { name: "Search tools" }).fill("Format JSON");
  await page
    .locator(".tool-open")
    .filter({
      has: page.getByRole("heading", { name: "Format JSON", exact: true }),
    })
    .click();
  await page.getByRole("textbox", { name: "Input text" }).fill("not json");
  await page.getByRole("button", { name: "Run tool" }).click();
  await page.waitForFunction(() =>
    document.querySelector(".job-top p")?.textContent.endsWith(" · error"),
  );
  results.push({ flow: "invalid JSON shows job error", pass: true });
  // Save dialog is stubbed to a test file; real copy and clipboard APIs run.
  await page
    .locator(".job")
    .filter({
      has: page.getByRole("heading", { name: "Format JSON", exact: true }),
    })
    .last()
    .getByRole("button", { name: "Copy result", exact: true })
    .click();
  const clipboard = await app.evaluate(({ clipboard }) => clipboard.readText());
  assert.match(clipboard, /hello/);
  const exportPath = path.join(runtime, "saved-result.txt");
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, exportPath);
  await page
    .locator(".job")
    .filter({
      has: page.getByRole("heading", { name: "Format JSON", exact: true }),
    })
    .last()
    .getByRole("button", { name: "Save first output as" })
    .click();
  await page.waitForTimeout(300);
  assert.match(await fs.readFile(exportPath, "utf8"), /hello/);
  results.push({ flow: "clipboard and save-as", pass: true });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(report, "all-flows.json"),
    JSON.stringify({ pass: true, results, errors }, null, 2),
  );
  console.log(`All ${results.length} flows passed`);
} catch (e) {
  await fs.writeFile(
    path.join(report, "all-flows.json"),
    JSON.stringify({ pass: false, results, errors, error: e.message }, null, 2),
  );
  await (
    await app.firstWindow()
  ).screenshot({ path: path.join(report, "flow-failure.png") });
  throw e;
} finally {
  await app.close();
}
