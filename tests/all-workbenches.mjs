import { _electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { tools } from "../shared/catalog.mjs";
const root = path.resolve("."),
  env = {
    ...process.env,
    SWITCHYARD_TEST_DATA: path.join(
      root,
      ".runtime-all-workbenches-" + Date.now(),
    ),
  };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: process.env.SWITCHYARD_TEST_EXE || path.join(root, "node_modules/electron/dist/electron.exe"),
  args: process.env.SWITCHYARD_TEST_EXE ? [] : [root],
  env,
});
const results = [],
  errors = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  for (const tool of tools.filter((t) => t.kind !== "batch")) {
    await page.getByRole("textbox", { name: "Search tools" }).fill(tool.name);
    await page
      .locator(".tool-open")
      .filter({
        has: page.getByRole("heading", { name: tool.name, exact: true }),
      })
      .click();
    const dialog = page.getByRole("dialog", { name: tool.name, exact: true });
    await dialog.waitFor();
    assert.equal(
      await dialog
        .getByRole("combobox", { name: "Operation", exact: true })
        .inputValue(),
      tool.id,
    );
    await dialog
      .getByRole("button", { name: "Create result", exact: true })
      .waitFor();
    assert.equal(
      await dialog
        .getByRole("combobox", { name: "Operation", exact: true })
        .locator("option")
        .count(),
      tools.filter((t) => t.category === tool.category && t.kind !== "batch")
        .length,
    );
    results.push(tool.id);
    await dialog.getByRole("button", { name: "Close tool" }).click();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "docs/verification/all-workbenches.json",
    JSON.stringify(
      {
        passed: results.length,
        scope:
          "Open/close, operation routing and Create result presence only; not output validation",
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    "Opened and closed",
    results.length,
    "workbenches without renderer errors",
  );
} finally {
  await app.close();
}
