import {_electron} from 'playwright';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('.'),env={...process.env,SWITCHYARD_TEST_DATA:path.join(root,'.runtime-voice-launch-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.join(root,'release-final/win-unpacked/Switchyard.exe'),env,args:[]});let voice;
try{
 const page=await app.firstWindow();await page.getByRole('button',{name:'Open Voice companion'}).click();const parent=await app.evaluate(()=>process.pid);
 for(let attempt=0;attempt<20;attempt++){
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "ParentProcessId=${parent} AND Name='SwitchyardVoice.exe'" | ForEach-Object { $p=Get-Process -Id $_.ProcessId; [PSCustomObject]@{Id=$p.Id;Visible=($p.MainWindowHandle -ne 0);Path=$p.Path} } | ConvertTo-Json -Compress`],{windowsHide:true});
  if(stdout.trim()){voice=JSON.parse(stdout);if(voice.Visible)break;}await new Promise(r=>setTimeout(r,200));
 }
 assert.ok(voice?.Visible,'Voice companion must open a visible window');assert.equal(path.resolve(voice.Path),path.join(root,'release-final/win-unpacked/resources/voice/SwitchyardVoice.exe'));
 await fs.writeFile(path.join(root,'docs/verification/voice-launch.json'),JSON.stringify({passed:true,flow:'Packaged Open Voice companion button opens its visible, isolated voice window'},null,2));console.log('Packaged voice launcher passed');
}finally{if(voice?.Id)process.kill(voice.Id);await app.close();}
