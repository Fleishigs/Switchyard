import { zipSync } from 'fflate';
import { writeFileSync } from 'node:fs';
export class TestZip {
  files = {};
  addFile(name, bytes) { this.files[name] = bytes; }
  writeZip(file) { writeFileSync(file, zipSync(this.files)); }
}
