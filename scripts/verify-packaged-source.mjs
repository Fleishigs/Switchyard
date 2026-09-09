import * as asar from '@electron/asar';import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve('.'),resources=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'release-final/win-unpacked/resources');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');const results=[];
for(const file of ['package.json','electron/media-preview.mjs','electron/pdf-preview.mjs','electron/main.cjs','electron/preload.cjs','electron/processor.mjs','electron/converter.mjs','electron/extras.mjs','electron/recall/main/main.js','electron/recall/main/export-xml.js','electron/recall/main/parsers/ndjson.js','shared/catalog.mjs','shared/formats.mjs','dist/index.html']){
 const sourceBytes=await fs.readFile(path.join(root,file)),packagedBytes=asar.extractFile(path.join(resources,'app.asar'),path.normalize(file));
 if(file==='package.json'){
  // electron-builder removes development-only metadata from the release manifest.
  const source=JSON.parse(sourceBytes),packaged=JSON.parse(packagedBytes);
  for(const field of ['name','version','main','dependencies','productName'])assert.deepEqual(packaged[field],source[field],file+': '+field);
  results.push({file,productionFieldsMatch:true,packagedSha256:hash(packagedBytes)});continue;
 }
 const source=hash(sourceBytes),packaged=hash(packagedBytes);assert.equal(packaged,source,file+' differs from source');results.push({file,sha256:source});
}
for(const name of await fs.readdir(path.join(root,'dist/assets'))){
 const file='dist/assets/'+name,source=hash(await fs.readFile(path.join(root,file))),packaged=hash(asar.extractFile(path.join(resources,'app.asar'),path.normalize(file)));assert.equal(packaged,source,file+' differs from built asset');results.push({file,sha256:source});
}
for(const file of ['SwitchyardVoice.exe','SwitchyardVoice.dll']){
 const source=hash(await fs.readFile(path.join(root,'voice/publish',file))),packaged=hash(await fs.readFile(path.join(resources,'voice',file)));assert.equal(packaged,source,file+' differs from published voice build');results.push({file:'voice/'+file,sha256:source});
}
await fs.writeFile(path.join(root,'docs/verification/source-package-hashes.json'),JSON.stringify({passed:true,resources,files:results},null,2));console.log(`${results.length} source and packaged artifacts match`);
