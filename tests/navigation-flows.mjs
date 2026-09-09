import {_electron} from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {categories,tools} from '../shared/catalog.mjs';
const root=path.resolve('.'),env={...process.env,SWITCHYARD_TEST_DATA:path.join(root,'.runtime-navigation-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.join(root,'release-final/win-unpacked/Switchyard.exe'),env,args:[]});const results=[];
try{
 const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.getByRole('button',{name:'Switchyard home'}).waitFor();
 for(const size of [[900,650],[1100,760],[1440,960]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),size);
  for(const category of categories){await page.getByRole('navigation',{name:'Tool categories'}).getByRole('button',{name:new RegExp('^'+category.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();assert.equal(await page.locator('.tool-card').count(),tools.filter(t=>t.category===category).length);}
  await page.getByRole('button',{name:'Messages',exact:true}).click();await page.getByRole('heading',{name:'Messages',exact:true}).waitFor();await page.getByRole('button',{name:/Queue & history/}).click();await page.getByRole('heading',{name:'Queue & history',exact:true}).waitFor();
  await page.getByRole('button',{name:/^Engines/}).click();await page.getByRole('button',{name:'Switchyard home'}).click();assert.equal(await page.locator('.tool-card').count(),tools.length);
  for(const name of [/Queue & history/,/^Engines/]){const rect=await page.getByRole('button',{name}).boundingBox();assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=await page.evaluate(()=>innerHeight));}
  await page.getByRole('button',{name:'Open Voice companion'}).scrollIntoViewIfNeeded();const voice=await page.getByRole('button',{name:'Open Voice companion'}).boundingBox();assert.ok(voice.y+voice.height<=await page.evaluate(()=>innerHeight));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));results.push(`Every category, Messages, Queue, Engines, Home and voice launcher reachable at ${size.join('x')}`);
 }
 await page.screenshot({path:path.join(root,'docs/verification/navigation-final.png')});await fs.writeFile(path.join(root,'docs/verification/navigation-flows.json'),JSON.stringify({passed:results.length,results},null,2));console.log(results);
}finally{await app.close();}
