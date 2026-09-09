import { _electron } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TestZip} from './zip-fixture.mjs';
const exec=promisify(execFile),root=path.resolve('.'),work=path.join(root,'.runtime-native-messages-'+Date.now());await fs.mkdir(work,{recursive:true});
const backup=path.join(work,'messages.ndjson'),contacts=path.join(work,'contacts.vcf'),output=path.join(work,'messages.xml');
await fs.writeFile(backup,JSON.stringify({_id:'1',thread_id:'1',address:'+15555550101',type:'1',date:'1780000000000',body:'Native Windows dialog verification'}));await fs.writeFile(contacts,'BEGIN:VCARD\nVERSION:3.0\nFN:Native Test\nTEL:+15555550101\nEND:VCARD');
const zipPath=path.join(work,'Fig backup.zip'),zip=new TestZip();zip.addFile('messages.ndjson',Buffer.from(JSON.stringify({_id:'2',thread_id:'1',address:'+15555550101',type:'1',date:'1780000000000',body:'Native Windows dialog verification from ZIP'})));zip.writeZip(zipPath);
const env={...process.env,SWITCHYARD_TEST_DATA:path.join(work,'profile')};delete env.ELECTRON_RUN_AS_NODE;
const config={executablePath:process.env.SWITCHYARD_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.SWITCHYARD_TEST_EXE?[]:[root],env};
let app=await _electron.launch(config);const results=[];
try{
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setTitle('Switchyard verification - synthetic files only'));let page=await app.firstWindow();page.setDefaultTimeout(25000);await page.getByRole('button',{name:'Messages',exact:true}).click();
 const native=async(button,file)=>{
  const pending=exec('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/native-file-dialog.ps1'),'-AppProcessId',String(await app.evaluate(()=>process.pid)),...(file?['-FilePath',file]:['-Cancel'])],{windowsHide:true,timeout:35000});
  await button.click();const result=await pending;console.log(result.stdout.trim());
 };
 await native(page.getByRole('button',{name:'Open Fig backup',exact:true}),null);await page.getByRole('heading',{name:/Old messages/}).waitFor();results.push('Open Fig backup displays actual Windows picker; Cancel works');
 await native(page.getByRole('button',{name:'Choose a backup'}),backup);await page.locator('.messages-thread').first().waitFor();results.push('Welcome button imports using actual Windows picker');
 await native(page.getByRole('button',{name:'Open Fig backup',exact:true}),zipPath);await page.locator('.messages-thread').filter({hasText:'from ZIP'}).waitFor();results.push('Open Fig backup imports a ZIP using the actual Windows picker');
 await native(page.getByRole('button',{name:'Import contacts',exact:true}),contacts);await page.getByRole('status').filter({hasText:'Imported 1 contacts'}).waitFor();results.push('Native contact file selection');
 await native(page.getByRole('button',{name:'Export XML',exact:true}),output);await page.getByRole('status').filter({hasText:'Exported 1 messages'}).waitFor();assert.match(await fs.readFile(output,'utf8'),/Native Windows dialog verification/);results.push('Native Save XML dialog writes correct file');
 await app.close();app=await _electron.launch(config);page=await app.firstWindow();page.setDefaultTimeout(25000);await page.getByRole('button',{name:'Messages',exact:true}).click();await page.locator('.messages-thread').first().waitFor();assert.match(await page.locator('.messages-thread').innerText(),/Native Test/);results.push('Full application restart restores messages and contact names');
 assert.equal(app.windows().length,1);await fs.writeFile(path.join(root,'docs/verification/messages-native-dialogs.json'),JSON.stringify({passed:results.length,results},null,2));console.log(results);
}finally{await app.close();}
