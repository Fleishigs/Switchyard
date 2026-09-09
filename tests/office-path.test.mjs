import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {processTool} from '../electron/processor.mjs';
test('Office conversion stages long output paths outside the Office profile',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'switchyard-office-path-'));
 try{
  const file=path.join(root,'source.csv');await fs.writeFile(file,'Name,Value\nSwitchyard,42');
  const outputDir=path.join(root,...Array(5).fill('long-output-folder-for-conversion-verification'));
  assert.ok(outputDir.length>250);
  const result=await processTool({toolId:'batch-convert',files:[file],options:{targets:{[file]:'xlsx'}}},{outputDir,engines:{office:process.env.SWITCHYARD_OFFICE_TEST_EXE||path.resolve('engines/office/program/soffice.com')}});
  assert.equal(result.failures,0,result.text);assert.ok((await fs.stat(result.outputs.find(p=>p.endsWith('.xlsx')))).size>0);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
