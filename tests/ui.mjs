import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { tools } from "../shared/catalog.mjs";
const root = path.resolve("."),
  report = path.join(root, "docs", "verification");
await fs.mkdir(report, { recursive: true });
const env = {
  ...process.env,
  SWITCHYARD_TEST_DATA: path.join(root, ".runtime-ui-" + Date.now()),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath:
    process.env.SWITCHYARD_TEST_EXE ||
    path.join(root, "node_modules/electron/dist/electron.exe"),
  args: [
    ...(process.env.SWITCHYARD_TEST_EXE ? [] : [root]),
    "--disable-gpu",
    "--mute-audio",
  ],
  env,
  timeout: 60000,
});
const errors = [];
const results = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Switchyard home" }).waitFor();
  assert.equal(await page.locator(".tool-card").count(), tools.length);
  results.push(`${tools.length} tools visible`);
  await page.screenshot({ path: path.join(report, "home-light.png") });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.screenshot({ path: path.join(report, "home-dark.png") });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page
    .getByRole("button", { name: "Favorite Enhance image", exact: true })
    .click();
  await page.getByRole("button", { name: /^Favorites/ }).click();
  assert.equal(await page.locator(".tool-card").count(), 1);
  results.push("favorites persist in UI");
  await page.getByRole("button", { name: /^All tools/ }).click();
  await page.getByRole("textbox", { name: "Search tools" }).fill("Format JSON");
  await page
    .locator(".tool-open")
    .filter({
      has: page.getByRole("heading", { name: "Format JSON", exact: true }),
    })
    .click();
  await page
    .getByRole("textbox", { name: "Input text" })
    .fill('{"switchyard":true}');
  await page.getByRole("button", { name: "Run tool" }).click();
  await page.waitForFunction(() =>
    document.querySelector(".job-top p")?.textContent.includes("done"),
  );
  assert.match(
    await page.locator(".text-result pre").innerText(),
    /"switchyard": true/,
  );
  results.push("text input → processing → output");
  await page.getByRole("button", { name: "Ask Switchyard" }).click();
  await page
    .getByRole("textbox", { name: "Describe a task" })
    .fill("crop image");
  await page.getByRole("button", { name: "Find matching tools" }).click();
  assert.ok((await page.locator(".match-list button").count()) > 0);
  results.push("command tool matching");
  await page.screenshot({ path: path.join(report, "command.png") });
  await page.getByRole("button", { name: "Engines", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".engine small")?.textContent !==
      "Checking availability…",
  );
  await page.screenshot({ path: path.join(report, "engines.png") });
  results.push("engine detection");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 760),
  );
  await page.getByRole("button", { name: "Switchyard home" }).click();
  await page.getByRole("textbox", { name: "Search tools" }).fill("");
  await page.screenshot({ path: path.join(report, "home-laptop.png") });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  results.push("laptop layout without overflow");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(report, "ui-results.json"),
    JSON.stringify({ pass: true, results, errors }, null, 2),
  );
  console.log(JSON.stringify({ pass: true, results }));
} catch (e) {
  const page = (await app.windows())[0];
  if (page) await page.screenshot({ path: path.join(report, "failure.png") });
  throw e;
} finally {
  await app.close();
}
