import {_electron} from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('.'),env={...process.env,SWITCHYARD_TEST_DATA:path.join(root,'.runtime-queue-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
const config={executablePath:path.join(root,'release-final/win-unpacked/Switchyard.exe'),env,args:['--mute-audio']};let app=await _electron.launch(config);const results=[];
try{
 let page=await app.firstWindow();page.setDefaultTimeout(20000);await page.getByRole('button',{name:'Switchyard home'}).waitFor();
 const file=path.join(root,'docs/verification/voice-fixture.wav');await page.evaluate(file=>window.switchyard.addPaths([file]),file);
 const running=await page.evaluate(file=>window.switchyard.run({toolId:'voice-vocals',files:[file],options:{},text:''}),file);
 const queued=await page.evaluate(()=>window.switchyard.run({toolId:'text-json',files:[],options:{},text:'{"queued":true}'}));
 await page.getByRole('button',{name:/Queue & history/}).click();await page.locator('.job').filter({has:page.getByRole('heading',{name:'Format JSON',exact:true})}).getByRole('button',{name:'Cancel'}).click();
 let state=await page.evaluate(()=>window.switchyard.state());assert.equal(state.jobs.find(j=>j.id===queued).status,'cancelled');results.push('cancel queued job');
 await page.locator('.job').filter({has:page.getByRole('heading',{name:'Separate vocals',exact:true})}).getByRole('button',{name:'Cancel'}).click();
 await page.locator('.job').filter({has:page.getByRole('heading',{name:'Separate vocals',exact:true})}).locator('.job-top p').filter({hasText:/cancelled$/}).waitFor();results.push('cancel running engine job');
 const good=await page.evaluate(()=>window.switchyard.run({toolId:'text-json',files:[],options:{},text:'{"recovered":true}'}));
 await page.locator('.job').filter({has:page.getByRole('heading',{name:'Format JSON',exact:true})}).first().locator('.job-top p').filter({hasText:/done$/}).waitFor();state=await page.evaluate(()=>window.switchyard.state());assert.match(state.jobs.find(j=>j.id===good).text,/"recovered": true/);results.push('queue recovers and executes next job');
 await app.close();app=await _electron.launch(config);page=await app.firstWindow();await page.getByRole('button',{name:/Queue & history/}).click();state=await page.evaluate(()=>window.switchyard.state());assert.equal(state.jobs.find(j=>j.id===running).status,'cancelled');assert.equal(state.jobs.find(j=>j.id===good).status,'done');results.push('cancelled and completed history survive restart');
 await fs.writeFile(path.join(root,'docs/verification/queue-flows.json'),JSON.stringify({passed:results.length,results},null,2));console.log(results);
}finally{await app.close();}
