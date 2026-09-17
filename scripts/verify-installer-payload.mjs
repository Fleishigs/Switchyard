import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
assert.ok(process.argv[2] && process.argv[3], 'Usage: node scripts/verify-installer-payload.mjs <packaged-app> <extracted-app> [report.json]');
const [source, extracted] = process.argv.slice(2, 4).map(p => path.resolve(p));
const reportPath = process.argv[4] || '.runtime-payload-verification.json';
async function list(root, relative = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await list(root, file));
    else if (entry.isFile()) result.push(file);
    else throw Error('Unexpected filesystem entry: ' + file);
  }
  return result.sort();
}
async function hash(file) {
  const sha = createHash('sha256');
  for await (const chunk of createReadStream(file)) sha.update(chunk);
  return sha.digest('hex');
}
const files = await list(source);
assert.deepEqual(await list(extracted), files, 'Installer must preserve the complete file list');
let bytes = 0;
for (let offset = 0; offset < files.length; offset += 8) {
  await Promise.all(files.slice(offset, offset + 8).map(async relative => {
    const a = path.join(source, relative), b = path.join(extracted, relative);
    const [sa, sb] = await Promise.all([fs.stat(a), fs.stat(b)]);
    assert.equal(sb.size, sa.size, relative + ': size');
    const [ha, hb] = await Promise.all([hash(a), hash(b)]);
    assert.equal(hb, ha, relative + ': SHA-256');
    bytes += sa.size;
  }));
}
const report = { passed: true, files: files.length, bytes, allFilesSha256Match: true };
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
