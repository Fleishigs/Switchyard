import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import YAML from 'yaml';import TOML from '@iarna/toml';import {XMLParser} from 'fast-xml-parser';import {parseCsv} from '../electron/extras.mjs';
export async function verifyConversion({family,target,input,outputs,engines,command,processTool}){
 const file=outputs.find(p=>!p.endsWith('conversion-report.json')),folder=path.join(path.dirname(file),'outcome-check');await fs.mkdir(folder,{recursive:true});
 const probe=async p=>JSON.parse(await command(path.join(path.dirname(engines.ffmpeg),'ffprobe.exe'),['-v','error','-show_streams','-show_format','-of','json',p]));
 const pdfText=async p=>{const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(await fs.readFile(p)),useSystemFonts:true,isEvalSupported:false});const doc=await task.promise;try{let s='';for(let i=1;i<=doc.numPages;i++)s+=(await (await doc.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ')+'\n';return s;}finally{await task.destroy();}};
 const zipText=async p=>command(engines.separator,['-c','import zipfile,sys,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); print(" ".join(" ".join(E.fromstring(z.read(n)).itertext()) for n in z.namelist() if n.endswith((".xml",".xhtml"))))',p]);
 const contains=(text,...values)=>values.forEach(v=>assert.ok(text.includes(v),`Converted ${family}/${target} lost ${v}`));
 const checkAudio=async()=>{const p=await probe(file),s=p.streams.find(s=>s.codec_type==='audio');assert.ok(s,'Missing audio stream');assert.ok(Number(p.format.duration)>.8&&Number(p.format.duration)<1.2);const expected={wav:'pcm_s16le',mp3:'mp3',flac:'flac',m4a:'aac',aac:'aac',ogg:'vorbis',opus:'opus',aiff:'pcm_s16be',wma:'wmav2',ac3:'ac3'};assert.equal(s.codec_name,expected[target]);let log='';await command(engines.ffmpeg,['-hide_banner','-i',file,'-af','volumedetect','-f','null','-'],{onLog:x=>log+=x});const peak=Number(log.match(/max_volume: (-?[\d.]+) dB/)?.[1]);assert.ok(Number.isFinite(peak)&&peak>-30,'Audio became silent');};
 if(family==='audio'||family==='video'&&['wav','mp3','flac','m4a','opus'].includes(target))return checkAudio();
 if(family==='image'||family==='video'){
  const p=await probe(file),s=p.streams.find(s=>s.codec_type==='video');assert.ok(s);const decoded=path.join(folder,'decoded.png');await command(engines.ffmpeg,['-v','error','-i',file,'-frames:v','1',decoded]);const {data,info}=await sharp(decoded).removeAlpha().raw().toBuffer({resolveWithObject:true});const i=(Math.floor(info.height/2)*info.width+Math.floor(info.width/2))*3;
  const expected=family==='image'?[85,136,102]:[0,128,0];for(let c=0;c<3;c++)assert.ok(Math.abs(data[i+c]-expected[c])<18,`${family}/${target} changed center color`);if(family==='video')assert.ok(Number(p.format.duration)>.8);return;
 }
 if(family==='archive'){const text=await command(engines.sevenz,['x','-so',file,'hello.txt']);assert.equal(text,'Switchyard archive test');return;}
 if(family==='font'){await command(engines.separator,['-c','from fontTools.ttLib import TTFont; import sys; a=TTFont(sys.argv[1]); b=TTFont(sys.argv[2]); assert a.getBestCmap()==b.getBestCmap(); assert a["head"].unitsPerEm==b["head"].unitsPerEm; assert a["maxp"].numGlyphs==b["maxp"].numGlyphs',input,file]);return;}
 if(family==='mesh'){await command(engines.separator,['-c','import trimesh,sys,numpy as np; m=trimesh.load_scene(sys.argv[1]).to_mesh(); assert np.allclose(m.bounds,[[-.5,-.5,-.5],[.5,.5,.5]]); assert abs(m.volume-1)<1e-5; assert len(m.faces)==12',file]);return;}
 if(family==='subtitle'){const srt=path.join(folder,'checked.srt');await command(engines.ffmpeg,['-v','error','-i',file,srt]);contains(await fs.readFile(srt,'utf8'),'00:00:00,000 --> 00:00:01,000','Switchyard subtitles');return;}
 if(family==='database'){const raw=await fs.readFile(file,'utf8'),rows=target==='json'?JSON.parse(raw):parseCsv(raw);assert.deepEqual(rows,[{name:'Switchyard',value:'42'}]);return;}
 if(family==='data'){const raw=await fs.readFile(file,'utf8');let rows;if(target==='json'||target==='txt')rows=JSON.parse(raw);if(target==='yaml')rows=YAML.parse(raw);if(target==='toml')rows=TOML.parse(raw).items;if(target==='xml')rows=[new XMLParser().parse(raw).root.item];if(target==='csv')rows=parseCsv(raw).map(r=>({...r,value:Number(r.value)}));assert.deepEqual(rows,[{name:'Switchyard',value:42}]);return;}
 if(family==='pdf'){
  if(['png','jpg'].includes(target)){const meta=await sharp(file).metadata();assert.ok(meta.width>500&&meta.height>700);const {channels}=await sharp(file).stats();assert.ok(channels[0].min<100&&channels[0].max===255);return;}
  const text=target==='txt'?await fs.readFile(file,'utf8'):await zipText(file);contains(text,'Switchyard PDF conversion');return;
 }
 if(family==='document'){
  let text;if(target==='pdf')text=await pdfText(file);else if(['docx','odt','epub'].includes(target))text=await zipText(file);else if(target==='rtf')text=(await fs.readFile(file,'utf8')).replace(/\\[a-z]+-?\d* ?/gi,'').replace(/[{}]/g,'');else text=await fs.readFile(file,'utf8');contains(text,'Switchyard','real document conversion','First item','Second item');return;
 }
 if(family==='spreadsheet'){
  let text;if(['xlsx','ods'].includes(target))text=await zipText(file);else if(target==='pdf')text=await pdfText(file);else text=await fs.readFile(file,'utf8');contains(text,'Switchyard','42','Workshop','17');if(target==='tsv'){assert.ok(text.includes('\t'));assert.equal(text.trim().split(/\r?\n/)[1].split('\t').length,2);}return;
 }
 if(family==='presentation'){
  let text;if(target==='pdf')text=await pdfText(file);else if(['pptx','odp'].includes(target))text=await zipText(file);else{const roundtrip=await processTool({toolId:'batch-convert',files:[file],options:{targets:{[file]:'pdf'}}},{outputDir:folder,engines});assert.equal(roundtrip.failures,0,roundtrip.text);text=await pdfText(roundtrip.outputs[0]);}contains(text,'Switchyard','real document conversion');return;
 }
 throw new Error('No outcome contract for '+family);
}
