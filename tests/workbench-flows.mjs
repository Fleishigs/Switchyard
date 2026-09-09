import sharp from "sharp";
import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { command } from "../electron/processor.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-workbench-" + Date.now());
await fs.mkdir(path.join(work, "first"), { recursive: true });
await fs.mkdir(path.join(work, "second"), { recursive: true });
const a = path.join(work, "first", "clip.mp4"),
  b = path.join(work, "second", "clip.mp4");
const ff = path.join(root, "engines/ffmpeg/ffmpeg.exe");
for (const [file, color, duration] of [
  [a, "red", 3],
  [b, "blue", 5],
])
  await command(ff, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=${color}:size=320x180:rate=20:duration=${duration}`,
    "-c:v",
    "libx264",
    "-y",
    file,
  ]);
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(work, "profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: process.env.SWITCHYARD_TEST_EXE || path.join(root, "node_modules/electron/dist/electron.exe"),
  args: [...(process.env.SWITCHYARD_TEST_EXE ? [] : [root]), "--disable-backgrounding-occluded-windows"],
  env,
});
const results = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  await app.evaluate(
    ({ BrowserWindow, dialog }, files) => {
      BrowserWindow.getAllWindows()[0].show();
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: files,
      });
    },
    [a, b, b],
  );
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Search tools" }).fill("Trim video");
  await page
    .locator(".tool-open")
    .filter({
      has: page.getByRole("heading", { name: "Trim video", exact: true }),
    })
    .click();
  const select = page.getByRole("combobox", { name: "Edit file", exact: true });
  assert.equal(await select.locator("option").count(), 2);
  assert.equal(await select.inputValue(), b);
  await page
    .getByRole("button", { name: "Create result", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".workbench-footer .primary")?.disabled,
  );
  assert.equal(
    await page.getByRole("textbox", { name: "Out point" }).inputValue(),
    "0:05.000",
  );
  results.push(
    "Duplicate picker paths removed; latest selected file initializes whole-clip trim",
  );
  await page.getByRole("button", { name: "Play preview", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".workbench video").currentTime > 0.2,
  );
  await page.getByRole("button", { name: "Pause preview" }).click();
  const pos = await page
    .locator(".workbench video")
    .evaluate((v) => v.currentTime);
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  assert.ok(
    Math.abs(
      (await page.locator(".workbench video").evaluate((v) => v.currentTime)) -
        pos -
        0.05,
    ) < 0.01,
  );
  results.push("Video actually plays, pauses and steps one 20-fps frame");
  const inp = page.getByRole("textbox", { name: "In point" }),
    out = page.getByRole("textbox", { name: "Out point" });
  await inp.fill("1.25");
  assert.equal(await inp.inputValue(), "1.25");
  await inp.press("Enter");
  await out.fill("2.75");
  await out.press("Enter");
  assert.equal(await inp.inputValue(), "0:01.250");
  await page.getByRole("button", { name: "Zoom in timeline" }).click();
  assert.equal(await inp.inputValue(), "0:01.250");
  await page.getByRole("slider", { name: "Pan timeline" }).fill("1");
  await page.getByRole("button", { name: "Fit whole file" }).click();
  results.push(
    "In/Out drafts commit correctly; zoom and pan preserve selection",
  );
  await page.screenshot({ path: "docs/verification/workbench-video.png" });
  await page
    .getByRole("button", { name: "Create result", exact: true })
    .click();
  let job;
  for (let attempt = 0; attempt < 200; attempt++) {
    job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
    if (["done", "error"].includes(job?.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(job.status, "done", job.error);
  assert.deepEqual(job.inputs, [b]);
  const meta = JSON.parse(
    await command(path.join(root, "engines/ffmpeg/ffprobe.exe"), [
      "-v",
      "error",
      "-show_format",
      "-of",
      "json",
      job.outputs[0],
    ]),
  );
  assert.ok(Math.abs(Number(meta.format.duration) - 1.5) < 0.06);
  const frameFile = path.join(work, "decoded.png");
  await command(ff, [
    "-v",
    "error",
    "-i",
    job.outputs[0],
    "-frames:v",
    "1",
    "-y",
    frameFile,
  ]);
  const pixel = await sharp(frameFile).resize(1, 1).raw().toBuffer();
  assert.ok(
    pixel[2] > 200 && pixel[0] < 20,
    "Export must contain the blue selected clip, not the red first clip",
  );
  assert.equal(
    await page.getByRole("dialog", { name: "Trim video" }).count(),
    1,
  );
  await page.getByRole("button", { name: "Play preview", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".workbench video").currentTime > 0.1,
  );
  results.push(
    "Create stays in editor; only selected second clip exports the exact interval; saved result plays",
  );
  await page.getByRole("button", { name: "Source", exact: true }).click();
  assert.equal(await inp.inputValue(), "0:01.250");
  assert.equal(await out.inputValue(), "0:02.750");
  await select.selectOption(a);
  await page.waitForFunction(
    () =>
      document.querySelector(".timeline-points input")?.value === "0:00.000",
  );
  assert.equal(await out.inputValue(), "0:03.000");
  results.push(
    "Source/result navigation preserves edit; changing source resets bounds to its own duration",
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(900, 650),
  );
  const box = await page
    .getByRole("button", { name: "Create result", exact: true })
    .boundingBox();
  assert.ok(box.y + box.height <= 650);
  await page.screenshot({ path: "docs/verification/workbench-small.png" });
  results.push("Create result remains visible at minimum window size");
  await fs.writeFile(
    "docs/verification/workbench-flows.json",
    JSON.stringify({ passed: results.length, results }, null, 2),
  );
  console.log(results);
} finally {
  await app.close();
}
