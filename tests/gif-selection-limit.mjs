import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { command, processTool } from "../electron/processor.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-gif-boundary-" + Date.now());
await fs.mkdir(work, { recursive: true });
const input = path.join(work, "long.mp4");
await command(path.resolve("engines/ffmpeg/ffmpeg.exe"), [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "color=blue:size=160x90:rate=12:duration=40",
  "-c:v",
  "libx264",
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
try {
  const page = await app.firstWindow();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, input);
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search tools" })
    .fill("Video to GIF");
  await page
    .locator(".tool-open")
    .filter({
      has: page.getByRole("heading", { name: "Video to GIF", exact: true }),
    })
    .click();
  await page.waitForFunction(
    () => !document.querySelector(".workbench-footer .primary").disabled,
  );
  const out = page.getByRole("textbox", { name: "Out point" });
  await out.fill("35");
  await out.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".timeline-points input")[1]?.value ===
      "0:30.000",
  );
  assert.equal(await out.inputValue(), "0:30.000");
  await assert.rejects(
    processTool(
      {
        toolId: "video-gif",
        files: [input],
        options: { start: 0, duration: 35 },
      },
      {
        outputDir: path.join(work, "output"),
        engines: {
          ffmpeg: path.resolve("engines/ffmpeg/ffmpeg.exe"),
          ffprobe: path.resolve("engines/ffmpeg/ffprobe.exe"),
        },
      },
    ),
    /limited to 30/,
  );
  await fs.writeFile(
    "docs/verification/gif-selection-limit.json",
    JSON.stringify(
      {
        passed: true,
        uiShowsActualMaximum: true,
        backendRejectsSilentTruncation: true,
      },
      null,
      2,
    ),
  );
  console.log("GIF editor and export agree on 30-second limit");
} finally {
  await app.close();
}
