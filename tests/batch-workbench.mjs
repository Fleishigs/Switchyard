import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { toolById } from "../shared/catalog.mjs";
const root = path.resolve("."),
  work = path.join(root, ".runtime-batch-workbench-" + Date.now());
await fs.mkdir(work, { recursive: true });
const first = path.join(work, "first.png"),
  second = path.join(work, "second.png");
for (const [p, width, color] of [
  [first, 100, "red"],
  [second, 200, "blue"],
])
  await sharp({
    create: { width, height: 100, channels: 3, background: color },
  })
    .png()
    .toFile(p);
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
let page;
async function open(id) {
  const name = toolById[id].name;
  await page.getByRole("textbox", { name: "Search tools" }).fill(name);
  await page
    .locator(".tool-open")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
}
async function run() {
  const old = (await page.evaluate(() => window.switchyard.state())).jobs[0]
    ?.id;
  await page
    .getByRole("button", { name: "Create result", exact: true })
    .click();
  let job;
  for (let i = 0; i < 200; i++) {
    job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
    if (job?.id !== old && ["done", "error"].includes(job?.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(job.status, "done", job.error);
  return job;
}
try {
  page = await app.firstWindow();
  await app.evaluate(
    ({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: files,
      });
    },
    [first, second],
  );
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  await open("image-png");
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Batch processing", exact: true })
      .isChecked(),
    false,
  );
  await page
    .getByRole("checkbox", { name: "Batch processing", exact: true })
    .check();
  await page
    .locator(".workbench-file-list label")
    .filter({ hasText: "first.png" })
    .getByRole("checkbox")
    .check();
  const j = await run();
  assert.deepEqual(j.inputs, [second, first]);
  assert.equal(j.outputs.length, 2);
  await page
    .getByRole("combobox", { name: "Result file", exact: true })
    .selectOption(j.outputs[1]);
  await page
    .getByRole("button", { name: "Compare before & after", exact: true })
    .click();
  const expected = await page.evaluate(
    (p) => window.switchyard.preview(p),
    first,
  );
  await page.waitForFunction(
    (url) => document.querySelector('img[alt="Original image"]')?.src === url,
    expected.url,
  );
  await page
    .getByRole("button", { name: "Use result as input", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector(".workbench-check input")?.checked,
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Edit file", exact: true })
      .inputValue(),
    j.outputs[1],
  );
  await page.getByRole("button", { name: "Close tool" }).click();
  await open("text-upper");
  await page
    .getByRole("textbox", { name: "Input text", exact: true })
    .fill("chain me");
  await run();
  await page
    .getByRole("button", { name: "Use result as input", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Input text", exact: true })
      .inputValue(),
    "CHAIN ME",
  );
  await fs.writeFile(
    "docs/verification/batch-workbench.json",
    JSON.stringify(
      {
        passed: true,
        explicitBatchTargets: true,
        selectedResultComparedToMatchingOriginal: true,
        selectedResultReuse: true,
        textResultReuse: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Batch targets, matching comparison and file/text result reuse passed",
  );
} finally {
  await app.close();
}
