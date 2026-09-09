import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { command } from "../electron/processor.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-audio-editor-" + Date.now());
await fs.mkdir(work, { recursive: true });
const input = path.join(work, "tone.wav");
await command(path.resolve("engines/ffmpeg/ffmpeg.exe"), [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=6",
  "-y",
  input,
]);
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(work, "profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
  args: [root],
  env,
});
const results = [];
try {
  const page = await app.firstWindow();
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, input);
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Search tools" }).fill("Trim audio");
  await page
    .locator(".tool-open")
    .filter({
      has: page.getByRole("heading", { name: "Trim audio", exact: true }),
    })
    .click();
  await page.waitForFunction(
    () => !document.querySelector(".workbench-footer .primary").disabled,
  );
  const peaks = await page.evaluate(
    (p) => window.switchyard.waveform(p),
    input,
  );
  assert.ok(peaks.some((x) => x > 0.05));
  const inField = page.getByRole("textbox", { name: "In point" }),
    out = page.getByRole("textbox", { name: "Out point" });
  await inField.fill("1");
  await inField.press("Enter");
  await page.getByRole("button", { name: "Undo adjustment" }).click();
  assert.equal(await inField.inputValue(), "0:00.000");
  await page.getByRole("button", { name: "Redo adjustment" }).click();
  assert.equal(await inField.inputValue(), "0:01.000");
  results.push("Real decoded waveform; Undo and Redo restore trim bounds");
  await out.fill("2");
  await out.press("Enter");
  await page.getByRole("button", { name: "Play selection" }).click();
  await page.waitForFunction(() => {
    const a = document.querySelector(".workbench audio");
    return a.paused && Math.abs(a.currentTime - 2) < 0.03;
  });
  results.push("Selection audition stops at the actual Out point");
  const handle = page.getByRole("slider", { name: "Selection start" }),
    box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  assert.ok(Number(await handle.getAttribute("aria-valuenow")) > 1);
  results.push(
    "Pointer capture moves trim handle and commits a changed source interval",
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await inField.fill("1");
  await inField.press("Enter");
  await out.fill("1.001");
  await out.press("Enter");
  await page
    .getByRole("button", { name: "Create result", exact: true })
    .click();
  let job;
  for (let i = 0; i < 200; i++) {
    job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
    if (["done", "error"].includes(job?.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(job.status, "done", job.error);
  const metadata = JSON.parse(
    await command(path.resolve("engines/ffmpeg/ffprobe.exe"), [
      "-v",
      "error",
      "-show_format",
      "-of",
      "json",
      job.outputs[0],
    ]),
  );
  assert.ok(Math.abs(Number(metadata.format.duration) - 0.001) < 0.0001);
  results.push("Minimum 1ms audio selection exports a decoded 1ms result");
  await fs.writeFile(
    "docs/verification/audio-editor.json",
    JSON.stringify({ passed: results.length, results }, null, 2),
  );
  console.log(results);
} finally {
  await app.close();
}
