// Network integration check: node tests/youtube-download.mjs <YouTube URL>
import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { command } from "../electron/processor.mjs";
import { tools } from "../shared/catalog.mjs";

const url = process.argv[2];
assert.ok(url, "Supply a publicly available YouTube URL");
const root = path.resolve(".");
const executablePath = path.resolve(process.env.SWITCHYARD_TEST_EXE || "release-final/win-unpacked/Switchyard.exe");
const engines = path.join(path.dirname(executablePath), "resources/engines");
await fs.access(path.join(engines, "deno.exe"));
const work = await fs.mkdtemp(path.join(root, ".runtime-youtube-ui-"));
// Exclude system Node/Deno installations so only the packaged runtime can work.
const env = { ...process.env, PATH: path.join(process.env.SystemRoot, "System32"), SWITCHYARD_TEST_DATA: path.join(work, "profile") };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ executablePath, args: ["--mute-audio"], env, timeout: 60000 });
const results = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  for (const id of ["download-audio", "download-video"]) {
    const tool = tools.find(t => t.id === id);
    await page.getByRole("textbox", { name: "Search tools" }).fill(tool.name);
    await page.locator(".tool-open").filter({ has: page.getByRole("heading", { name: tool.name, exact: true }) }).click();
    await page.getByLabel(tool.options.find(o => o.key === "url").label, { exact: true }).fill(url);
    const previous = (await page.evaluate(() => window.switchyard.state())).jobs[0]?.id;
    await page.getByRole("button", { name: "Create result", exact: true }).click();
    let job;
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
      job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
      if (job?.id !== previous && ["done", "error"].includes(job?.status)) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.equal(job?.status, "done", job?.error || "Download timed out");
    assert.doesNotMatch(job.log || "", /No supported JavaScript runtime|challenge solving failed/i);
    assert.equal(job.outputs.length, 1);
    const probe = JSON.parse(await command(path.join(engines, "ffmpeg/ffprobe.exe"), ["-v", "error", "-show_streams", "-show_format", "-of", "json", job.outputs[0]]));
    assert.ok(Number(probe.format.duration) > 0);
    assert.ok(probe.streams.some(s => s.codec_type === "audio"));
    if (id === "download-video") assert.ok(probe.streams.some(s => s.codec_type === "video"));
    else assert.ok(probe.streams.some(s => s.codec_name === "mp3"));
    await page.getByRole("button", { name: "Play preview", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".workbench video,.workbench audio")?.currentTime > 0.2);
    results.push({ tool: id, duration: Number(probe.format.duration), resultPlayback: true, output: job.outputs[0] });
    console.log("PASS", id, results.at(-1));
    await page.getByRole("button", { name: "Close tool" }).click();
  }
  await fs.writeFile(path.join(work, "verification.json"), JSON.stringify({ passed: true, systemRuntimesExcluded: true, results }, null, 2));
  console.log("Verification:", path.join(work, "verification.json"));
} finally {
  await app.close();
}
