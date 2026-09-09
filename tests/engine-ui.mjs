import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { tools } from "../shared/catalog.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-engine-ui-" + Date.now());
await fs.mkdir(work, { recursive: true });
const speech = path.resolve("docs/verification/voice-fixture.wav");
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
const results = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, speech);
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  for (const tool of tools.filter((t) =>
    ["engine", "download"].includes(t.kind),
  )) {
    await page.getByRole("textbox", { name: "Search tools" }).fill(tool.name);
    await page
      .locator(".tool-open")
      .filter({
        has: page.getByRole("heading", { name: tool.name, exact: true }),
      })
      .click();
    if (tool.kind === "download")
      await page
        .getByLabel(tool.options.find((o) => o.key === "url").label, {
          exact: true,
        })
        .fill("https://www.youtube.com/watch?v=YE7VzlLtp-4");
    const previous = (await page.evaluate(() => window.switchyard.state()))
      .jobs[0]?.id;
    await page
      .getByRole("button", { name: "Create result", exact: true })
      .click();
    let job;
    for (let i = 0; i < 6000; i++) {
      job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
      if (job?.id !== previous && ["done", "error"].includes(job?.status))
        break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(job.status, "done", job.error);
    if (tool.id === "voice-transcribe")
      assert.match(job.text, /voice stays on your computer/i);
    if (tool.id === "voice-vocals")
      assert.equal(job.outputs.filter((p) => p.endsWith(".wav")).length, 2);
    for (const file of job.outputs) assert.ok((await fs.stat(file)).size > 0);
    if (tool.kind === "download" || tool.id === "voice-vocals") {
      await page
        .getByRole("button", { name: "Play preview", exact: true })
        .click();
      await page.waitForFunction(() => {
        const p = document.querySelector(".workbench video,.workbench audio");
        return p?.currentTime > 0.2;
      });
    }
    results.push({
      tool: tool.id,
      pass: true,
      outputs: job.outputs.length,
      resultPlayback: tool.id !== "voice-transcribe",
    });
    console.log("PASS UI", tool.id);
    await page.getByRole("button", { name: "Close tool" }).click();
  }
  await fs.writeFile(
    "docs/verification/engine-ui.json",
    JSON.stringify({ passed: results.length, results }, null, 2),
  );
} finally {
  await app.close();
}
