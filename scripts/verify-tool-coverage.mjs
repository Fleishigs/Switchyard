import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {tools} from '../shared/catalog.mjs';
const read=async name=>JSON.parse((await fs.readFile(new URL('../docs/verification/'+name,import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const evidence=new Map();
for(const name of ['all-flows.json','engine-flows.json']){
 const report=await read(name);assert.equal(report.pass,true,name);
 for(const result of report.results){assert.equal(result.pass,true,name);if(result.tool)evidence.set(result.tool,name);}
}
const converters=await read('packaged-converters.json');assert.equal(converters.passed,2);assert.ok(converters.results.includes('all 13 conversion families run from bundled executable and engines'));assert.ok(converters.results.includes('packaged OCR worker, WASM and local English model'));
evidence.set('batch-convert','packaged-converters.json');evidence.set('image-ocr','packaged-converters.json');
const missing=tools.filter(tool=>!evidence.has(tool.id)).map(tool=>tool.id);assert.deepEqual(missing,[],'Registered tools without a passing processing flow');
const results=tools.map(tool=>({id:tool.id,name:tool.name,evidence:evidence.get(tool.id)}));
await fs.writeFile(new URL('../docs/verification/tool-coverage.json',import.meta.url),JSON.stringify({passed:true,registered:tools.length,covered:results.length,scope:'Supported processing routes with representative fixtures; not exhaustive input or setting combinations.',results},null,2));
console.log(`${results.length}/${tools.length} registered tools have passing processing evidence`);
