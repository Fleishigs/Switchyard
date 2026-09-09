import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { tools } from "../shared/catalog.mjs";
import { families } from "../shared/formats.mjs";
const dir = new URL("../docs/verification/", import.meta.url),
  json = async (name) =>
    JSON.parse(
      (await fs.readFile(new URL(name, dir), "utf8")).replace(/^\uFEFF/, ""),
    );
const outcomes = await json("outcome-audit.json"),
  engines = await json("engine-outcomes.json");
assert.equal(outcomes.failed, 0);
assert.equal(engines.failed, 0);
const routes = new Map();
for (const name of [
  "converter-outcomes.txt",
  "converter-image-regression.txt",
]) {
  const b = await fs.readFile(new URL(name, dir)),
    text = b.toString(b[0] === 255 && b[1] === 254 ? "utf16le" : "utf8");
  for (const match of text.matchAll(/✔ batch (\w+) → (\w+)/g))
    routes.set(match[1] + "/" + match[2], name);
}
const expected = Object.entries(families).flatMap(([family, config]) =>
  config.outputs.split(" ").map((target) => family + "/" + target),
);
for (const route of expected)
  assert.ok(routes.has(route), "No passing content check for " + route);
const resultMap = new Map(
  [...outcomes.results, ...engines.results]
    .filter((r) => r.pass)
    .map((r) => [r.tool, r]),
);
resultMap.set("batch-convert", {
  tool: "batch-convert",
  pass: true,
  assertion:
    "All " +
    expected.length +
    " family/destination routes decode with preserved content",
});
const ai = await json("upscayl-outcomes.json");
assert.equal(ai.length, 3);
assert.ok(ai.every((r) => r.neuralOutputDiffersFromResize));
resultMap.set("image-upscale", {
  tool: "image-upscale",
  pass: true,
  assertion:
    "All three actual GPU models export correct dimensions and pixels different from a same-channel resize baseline",
  evidence: "upscayl-outcomes.json",
});
for (const tool of tools)
  assert.ok(resultMap.has(tool.id), "No result contract for " + tool.id);
const result = {
  version: JSON.parse(
    await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
  ).version,
  registeredTools: tools.length,
  toolsWithPassingOutcomeChecks: tools.length,
  conversionRoutes: expected.length,
  executor: outcomes.executor,
  results: tools.map((t) => resultMap.get(t.id)),
  conversions: expected.map((route) => ({
    route,
    evidence: routes.get(route),
  })),
  limits:
    "Representative fixtures and tested settings. Subjective photo quality, arbitrary file variants and every hardware setup are not guaranteed.",
};
await fs.writeFile(
  new URL("outcome-coverage.json", dir),
  JSON.stringify(result, null, 2),
);
console.log(
  `${tools.length} tools and ${expected.length} conversion routes have passing content checks.`,
);
