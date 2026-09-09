import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { tools } from "../shared/catalog.mjs";
import { textFixture } from "./fixtures.mjs";
import { command } from "../electron/processor.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-all-tool-runs-" + Date.now());
await fs.mkdir(work, { recursive: true });
const image = path.join(work, "picture.png"),
  audio = path.join(work, "tone.wav"),
  video = path.join(work, "clip.mp4"),
  pdf = path.join(work, "pages.pdf");
await sharp(
  Buffer.from(
    '<svg width="1920" height="1440"><rect width="1920" height="1440" fill="#ddddcc"/><rect x="100" y="100" width="800" height="600" fill="#407058"/><text x="200" y="1000" font-size="90" fill="black">SWITCHYARD TEST 123</text></svg>',
  ),
)
  .png()
  .toFile(image);
await command(path.resolve("engines/ffmpeg/ffmpeg.exe"), [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=3",
  "-y",
  audio,
]);
await command(path.resolve("engines/ffmpeg/ffmpeg.exe"), [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=320x180:rate=20:duration=3",
  "-i",
  audio,
  "-c:v",
  "libx264",
  "-c:a",
  "aac",
  "-y",
  video,
]);
const doc = await PDFDocument.create();
for (let i = 0; i < 3; i++) doc.addPage([300, 400]).drawText("PAGE " + (i + 1));
await fs.writeFile(pdf, await doc.save());
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(work, "profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath:
    process.env.SWITCHYARD_TEST_EXE ||
    path.resolve("node_modules/electron/dist/electron.exe"),
  args: process.env.SWITCHYARD_TEST_EXE ? [] : [root],
  env,
});
const results = [],
  errors = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(
    ({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: files,
      });
    },
    [image, audio, video, pdf],
  );
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  for (const tool of tools.filter(
    (t) =>
      !["batch", "download", "engine"].includes(t.kind) &&
      t.id !== "image-upscale",
  )) {
    try {
      await page.getByRole("textbox", { name: "Search tools" }).fill(tool.name);
      await page
        .locator(".tool-open")
        .filter({
          has: page.getByRole("heading", { name: tool.name, exact: true }),
        })
        .click();
      if (tool.kind === "text")
        await page
          .getByRole("textbox", { name: "Input text", exact: true })
          .fill(textFixture(tool.id));
      if (tool.kind === "audio")
        await page
          .getByRole("combobox", { name: "Edit file", exact: true })
          .selectOption(audio);
      await page.waitForFunction(
        () => !document.querySelector(".workbench-footer .primary")?.disabled,
      );
      const before = (await page.evaluate(() => window.switchyard.state()))
        .jobs[0]?.id;
      await page
        .getByRole("button", { name: "Create result", exact: true })
        .click();
      let job;
      for (let i = 0; i < 900; i++) {
        job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
        if (
          job?.id !== before &&
          ["done", "error", "partial"].includes(job?.status)
        )
          break;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(job.status, "done", job.error);
      assert.equal(job.toolId, tool.id);
      assert.ok(job.outputs.length > 0);
      for (const output of job.outputs)
        assert.ok((await fs.stat(output)).size > 0);
      assert.equal(
        await page
          .getByRole("dialog", { name: tool.name, exact: true })
          .count(),
        1,
      );
      results.push({
        tool: tool.id,
        pass: true,
        actualOutputFiles: job.outputs.length,
      });
      console.log("PASS UI", tool.id);
      await page.getByRole("button", { name: "Close tool" }).click();
    } catch (e) {
      results.push({ tool: tool.id, pass: false, error: e.message });
      console.log("FAIL UI", tool.id, e.message);
      if (await page.getByRole("button", { name: "Close tool" }).count())
        await page.getByRole("button", { name: "Close tool" }).click();
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "docs/verification/all-tool-runs.json",
    JSON.stringify(
      {
        passed: results.filter((r) => r.pass).length,
        failed: results.filter((r) => !r.pass).length,
        scope:
          "Actual UI selection/options/Create result through IPC; output existence and editor persistence. Independent decoded content is covered separately in outcome-audit.",
        results,
      },
      null,
      2,
    ),
  );
  if (results.some((r) => !r.pass)) process.exitCode = 1;
} finally {
  await app.close();
}
