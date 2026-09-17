// Keep the static, offline-readable documentation catalogue aligned with the app.
import fs from 'node:fs/promises';
import { tools } from '../shared/catalog.mjs';
const file = new URL('../docs/index.html', import.meta.url);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const cards = tools.map(tool => `<article class="tool" data-category="${escape(tool.category)}"><small>${escape(tool.category)}</small><h3>${escape(tool.name)}</h3><p>${escape(tool.description)}</p></article>`).join('\n');
const start = '<!-- TOOL_CATALOGUE -->', end = '<!-- /TOOL_CATALOGUE -->';
let html = await fs.readFile(file, 'utf8');
const first = html.indexOf(start), last = html.indexOf(end);
if (first < 0) throw new Error('Missing catalogue marker');
if (last < 0) html = html.replace(start, `${start}\n${cards}\n${end}`);
else html = html.slice(0, first) + `${start}\n${cards}\n${end}` + html.slice(last + end.length);
await fs.writeFile(file, html);
console.log(`Documented ${tools.length} tools.`);
