import {_electron} from 'playwright';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.'),work=path.join(root,'.runtime-controls-'+Date.now()),exec=promisify(execFile);
await fs.mkdir(work,{recursive:true});const input=path.join(work,'controls.txt');await fs.writeFile(input,'Synthetic control test');
const env={...process.env,SWITCHYARD_TEST_DATA:path.join(work,'profile')};delete env.ELECTRON_RUN_AS_NODE;
const config={executablePath:path.join(root,'release-final/win-unpacked/Switchyard.exe'),env};
let app=await _electron.launch(config);const results=[];
try{
 let page=await app.firstWindow();page.setDefaultTimeout(30000);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setTitle('Switchyard verification - controls'));
 const native=async(button,file)=>{const pending=exec('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/native-file-dialog.ps1'),'-AppProcessId',String(await app.evaluate(()=>process.pid)),...(file?['-FilePath',file]:['-Cancel'])],{windowsHide:true,timeout:35000});await button.click();await pending;};
 const add=page.getByRole('button',{name:'Add files',exact:true}).first();await native(add,null);assert.equal(await page.locator('.tray-file').count(),0);results.push('Native Add files cancellation');
 await native(add,input);await page.locator('.tray-file').waitFor();await native(add,input);assert.equal(await page.locator('.tray-file').count(),1);await page.getByRole('button',{name:'Remove controls.txt'}).click();assert.equal(await page.locator('.tray-file').count(),0);results.push('Native file selection, duplicate suppression and individual removal');
 await page.getByRole('button',{name:'Make something better'}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);results.push('Hero opens enhancement; Escape closes settings');
 await page.keyboard.press('Control+k');assert.equal(await page.getByRole('textbox',{name:'Search tools'}).evaluate(e=>e===document.activeElement),true);await page.getByRole('textbox',{name:'Search tools'}).fill('zzznomatches987');await page.getByRole('heading',{name:'Nothing here yet'}).waitFor();await page.getByRole('textbox',{name:'Search tools'}).fill('');results.push('Search keyboard shortcut and empty results');
 await page.getByRole('button',{name:'Ask Switchyard',exact:true}).click();for(const label of ['Make an image smaller','Remove audio from a video','Merge PDF files','Create a QR code']){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Describe a task'}).inputValue(),label);}results.push('All four task suggestion buttons');
 await page.getByRole('textbox',{name:'Describe a task'}).fill('zzznomatches987');await page.getByRole('button',{name:'Find matching tools'}).click();await page.getByText('No matching tools yet.',{exact:false}).waitFor();results.push('Task finder empty-match recovery');
 const initial=(await page.evaluate(()=>window.switchyard.state())).settings;await page.getByRole('button',{name:'Engines',exact:true}).click();await page.getByRole('heading',{name:'Processing engines'}).waitFor();
 const rows=[['ffmpeg','FFmpeg'],['ffprobe','FFprobe'],['ytdlp','yt-dlp'],['whisper','Whisper CLI'],['whisperModel','Whisper model'],['separator','UVR separator'],['pandoc','Pandoc'],['office','LibreOffice'],['sevenz','7-Zip']];
 await native(page.locator('.engine').first().getByRole('button',{name:'Choose file'}),null);assert.equal((await page.evaluate(()=>window.switchyard.state())).settings.engines.ffmpeg,initial.engines.ffmpeg);results.push('Engine picker cancellation preserves setting');
 for(const [key,title] of rows){const row=page.locator('.engine').filter({has:page.getByRole('heading',{name:title,exact:true})});await native(row.getByRole('button',{name:'Choose file'}),initial.engines[key]);assert.equal((await page.evaluate(()=>window.switchyard.state())).settings.engines[key],initial.engines[key]);results.push(title+' native executable/model picker');}
 await page.getByRole('button',{name:'Refresh status',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.engine .status-dot.ready').length===9,null,{timeout:120000});results.push('Refresh verifies all nine engine statuses');
 await page.getByRole('button',{name:'Toggle theme'}).click();const theme=await page.locator('html').getAttribute('data-theme');await app.close();app=await _electron.launch(config);page=await app.firstWindow();await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);assert.deepEqual((await page.evaluate(()=>window.switchyard.state())).settings.engines,initial.engines);results.push('Theme and engine choices survive a full restart');
 await fs.writeFile(path.join(root,'docs/verification/controls-flows.json'),JSON.stringify({passed:results.length,results},null,2));console.log(results);
}finally{await app.close();}
