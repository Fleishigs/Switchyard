import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
const root = path.resolve("."),
  work = path.join(root, ".runtime-editor-families-" + Date.now());
await fs.mkdir(work, { recursive: true });
const input = path.join(work, "image.png");
await sharp({
  create: {
    width: 128,
    height: 96,
    channels: 4,
    background: { r: 40, g: 100, b: 180, alpha: 0.5 },
  },
})
  .png()
  .toFile(input);
const pdfs = [];
for (const n of [1, 2]) {
  const d = await PDFDocument.create();
  d.addPage([n * 200, 300]);
  const p = path.join(work, `document-${n}.pdf`);
  await fs.writeFile(p, await d.save());
  pdfs.push(p);
}
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(work, "profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: process.env.SWITCHYARD_TEST_EXE || path.join(root, "node_modules/electron/dist/electron.exe"),
  args: process.env.SWITCHYARD_TEST_EXE ? [] : [root],
  env,
});
const reports = [];
let page;
async function open(name) {
  await page.getByRole("textbox", { name: "Search tools" }).fill(name);
  await page
    .locator(".tool-open")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
}
async function run() {
  await page
    .getByRole("button", { name: "Create result", exact: true })
    .click();
  let job;
  for (let i = 0; i < 1200; i++) {
    job = (await page.evaluate(() => window.switchyard.state())).jobs[0];
    if (["done", "error"].includes(job?.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(job.status, "done", job.error);
  return job;
}
try {
  page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  await app.evaluate(
    ({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: files,
      });
    },
    [input, ...pdfs],
  );
  await page
    .getByRole("button", { name: "Add files", exact: true })
    .first()
    .click();
  await open("AI image enhancement");
  const j = await run(),
    meta = await sharp(j.outputs[0]).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.hasAlpha, true);
  await page
    .getByRole("button", { name: "Inspect detail", exact: true })
    .click();
  await page.getByRole("img", { name: "Image preview", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fit image", exact: true }).click();
  await page
    .getByRole("button", { name: "Compare before & after", exact: true })
    .click();
  await page.getByRole("slider", { name: "Reveal processed image" }).fill("25");
  assert.ok(
    await page
      .getByRole("img", { name: "Processed image", exact: true })
      .evaluate((im) => im.complete && im.naturalWidth > 0),
  );
  const saved = path.join(work, "saved.png");
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, saved);
  await page.getByRole("button", { name: "Save as…", exact: true }).click();
  for (let i = 0; i < 50; i++) {
    try {
      await fs.access(saved);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.deepEqual(await fs.readFile(saved), await fs.readFile(j.outputs[0]));
  await page
    .getByRole("button", { name: "Use result as input", exact: true })
    .click();
  await page.getByRole("button", { name: "Source", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Edit file", exact: true })
      .inputValue(),
    j.outputs[0],
  );
  reports.push(
    "Actual AI IPC job, alpha-preserving 2x output, detail view, comparison slider, byte-identical Save as and reuse chain",
  );
  await page.getByRole("button", { name: "Close tool" }).click();
  await open("Merge PDFs");
  const list = page.locator(".workbench-file-list");
  await list.getByRole("button", { name: "Earlier document-2.pdf" }).click();
  assert.ok(
    (await list.locator("label").first().textContent()).includes("document-2"),
  );
  const merged = await run(),
    doc = await PDFDocument.load(await fs.readFile(merged.outputs[0]));
  assert.equal(doc.getPage(0).getWidth(), 400);
  assert.equal(doc.getPage(1).getWidth(), 200);
  await page.getByRole("img", { name: "PDF page 1", exact: true }).waitFor();
  reports.push(
    "PDF order controls visually reorder inputs and saved pages match that exact order",
  );
  await page.getByRole("button", { name: "Close tool" }).click();
  const { tools } = await import("../shared/catalog.mjs");
  await open(tools.find((t) => t.id === "text-diff").name);
  await page
    .getByRole("textbox", { name: "Input text", exact: true })
    .fill("same\nold\n");
  await page
    .getByRole("textbox", { name: "Second text", exact: true })
    .fill("same\nnew\n");
  await run();
  assert.equal(await page.locator(".diff-added").textContent(), "new\n");
  assert.equal(await page.locator(".diff-removed").textContent(), "old\n");
  reports.push(
    "Text comparison processes both inputs and renders actual added/removed lines",
  );
  await fs.writeFile(
    "docs/verification/editor-families.json",
    JSON.stringify({ passed: reports.length, reports }, null, 2),
  );
  console.log(reports);
} finally {
  await app.close();
}
