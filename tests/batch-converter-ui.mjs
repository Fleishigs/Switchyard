import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { command } from "../electron/processor.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-converter-ui-" + Date.now());
await fs.mkdir(work, { recursive: true });
const picture = path.join(work, "picture.png"),
  audio = path.join(work, "tone.wav");
await sharp({
  create: { width: 80, height: 60, channels: 3, background: "red" },
})
  .png()
  .toFile(picture);
await command(path.resolve("engines/ffmpeg/ffmpeg.exe"), [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=1",
  "-y",
  audio,
]);
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(work, "profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: path.resolve("release-final/win-unpacked/Switchyard.exe"),
  args: [],
  env,
});
try {
  const page = await app.firstWindow();
  await app.evaluate(
    ({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: files,
      });
    },
    [picture, audio],
  );
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  await page
    .locator(".nav-item")
    .filter({ hasText: "Batch converter" })
    .click();
  await page
    .getByRole("combobox", { name: "Output format for picture.png" })
    .selectOption("webp");
  await page
    .getByRole("combobox", { name: "Output format for tone.wav" })
    .selectOption("mp3");
  await page.getByRole("button", { name: "Convert 2 files" }).click();
  let job;
  for (let i = 0; i < 200; i++) {
    job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
    if (["done", "error", "partial"].includes(job?.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(job.status, "done", job.error);
  assert.equal(job.toolId, "batch-convert");
  const im = job.outputs.find((p) => p.endsWith(".webp")),
    sound = job.outputs.find((p) => p.endsWith(".mp3"));
  assert.ok(im && sound);
  assert.equal((await sharp(im).metadata()).width, 80);
  const probe = JSON.parse(
    await command(path.resolve("engines/ffmpeg/ffprobe.exe"), [
      "-v",
      "error",
      "-show_streams",
      "-of",
      "json",
      sound,
    ]),
  );
  assert.equal(probe.streams[0].codec_name, "mp3");
  await fs.writeFile(
    "docs/verification/batch-converter-ui.json",
    JSON.stringify(
      {
        passed: true,
        mixedTargetsMatch: true,
        imageDecoded: true,
        audioCodecVerified: true,
      },
      null,
      2,
    ),
  );
  console.log("Batch converter mixed image/audio UI flow passed");
} finally {
  await app.close();
}
