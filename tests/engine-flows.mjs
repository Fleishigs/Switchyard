import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("."),
  report = path.join(root, "docs/verification"),
  data = path.join(root, ".runtime-engines-" + Date.now());
const env = { ...process.env, SWITCHYARD_TEST_DATA: data };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath:
    process.env.SWITCHYARD_TEST_EXE ||
    path.join(root, "node_modules/electron/dist/electron.exe"),
  args: [
    ...(process.env.SWITCHYARD_TEST_EXE ? [] : [root]),
    "--disable-gpu",
    "--mute-audio",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
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
  const status = await page.evaluate(() => window.switchyard.engineStatus());
  for (const key of [
    "ffmpeg",
    "ffprobe",
    "ytdlp",
    "whisper",
    "whisperModel",
    "separator",
  ])
    assert.equal(status[key].ready, true, `${key}: ${status[key].detail}`);
  results.push({ flow: "all bundled engines detected", pass: true });
  const fixture = path.join(root, "docs/verification/voice-fixture.wav");
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, fixture);
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  for (const [name, id] of [
    ["Local transcription", "voice-transcribe"],
    ["Separate vocals", "voice-vocals"],
  ]) {
    await page.getByRole("textbox", { name: "Search tools" }).fill(name);
    await page
      .locator(".tool-open")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .click();
    await page.getByRole("button", { name: "Run tool" }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".job-top p")
          ?.textContent.match(/ · (done|error)$/),
      {},
      { timeout: 180000 },
    );
    const j = await page.evaluate(
      async () => (await window.switchyard.state()).jobs[0],
    );
    assert.equal(j.status, "done", j.error);
    assert.equal(j.outputs.length, 2);
    for (const p of j.outputs) assert.ok((await fs.stat(p)).size > 0);
    if (id === "voice-transcribe")
      assert.match(j.text, /voice stays on your computer/i);
    results.push({ tool: id, pass: true, outputs: j.outputs.length });
    console.log("PASS " + id);
  }
  await page.getByRole("button", { name: "Clear tray" }).click();
  for (const name of ["Download video", "Download audio"]) {
    await page.getByRole("textbox", { name: "Search tools" }).fill(name);
    await page
      .locator(".tool-open")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .click();
    await page
      .getByLabel("Video URL", { exact: true })
      .fill("https://www.youtube.com/watch?v=YE7VzlLtp-4");
    await page.getByRole("button", { name: "Run tool" }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".job-top p")
          ?.textContent.match(/ · (done|error)$/),
      {},
      { timeout: 240000 },
    );
    const j = await page.evaluate(
      async () => (await window.switchyard.state()).jobs[0],
    );
    assert.equal(j.status, "done", j.error);
    assert.ok((await fs.stat(j.outputs[0])).size > 100000);
    results.push({
      tool: j.toolId,
      pass: true,
      bytes: (await fs.stat(j.outputs[0])).size,
    });
    console.log("PASS " + j.toolId);
  }
  await page.getByRole("button", { name: "Record a thought" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("dialog").waitFor();
  assert.match(await page.locator(".tray-file strong").innerText(), /webm$/);
  await page.getByRole("button", { name: "Close tool" }).click();
  results.push({
    flow: "microphone permission, recording, stop, local audio file",
    pass: true,
  });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(report, "engine-flows.json"),
    JSON.stringify({ pass: true, results, errors, status }, null, 2),
  );
  console.log(JSON.stringify({ pass: true, results }));
} catch (e) {
  await fs.writeFile(
    path.join(report, "engine-flows.json"),
    JSON.stringify({ pass: false, results, errors, error: e.message }, null, 2),
  );
  await (
    await app.firstWindow()
  ).screenshot({ path: path.join(report, "engine-failure.png") });
  throw e;
} finally {
  await app.close();
}
