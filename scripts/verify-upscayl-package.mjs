import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await fs.readFile("engines/upscayl/provenance.json", "utf8"),
);
const files = [];
for (const file of [
  "upscayl-bin.exe",
  "LICENSE",
  "MODEL-LICENSE.txt",
  "provenance.json",
  ...manifest.models.map((m) => "models/" + m.file),
]) {
  const original = await fs.readFile(path.join("engines/upscayl", file)),
    packed = await fs.readFile(
      path.join("release-final/win-unpacked/resources/engines/upscayl", file),
    );
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  if (hash(original) !== hash(packed))
    throw Error("Packaged engine differs: " + file);
  files.push({ file, sha256: hash(original) });
}
await fs.writeFile(
  "docs/verification/upscayl-package.json",
  JSON.stringify({ passed: true, files }, null, 2),
);
await fs.copyFile(
  "engines/upscayl/provenance.json",
  "docs/upscayl-provenance.json",
);
console.log("Engine, models and licenses match packaged copies");
