import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';import {processTool} from '../electron/processor.mjs';
const input=process.argv[2];if(!input)throw new Error('Pass an image path. Inputs are never modified.');
const root=path.resolve('.'),work=path.join(root,'.runtime-enhancement-benchmark-'+Date.now());await fs.mkdir(work,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),originalHash=hash(await fs.readFile(input)),meta=await sharp(input).metadata(),runs=[];
for(let i=0;i<3;i++){
 let start=performance.now();const old=await sharp(input).rotate().normalise().sharpen({sigma:1}).png({quality:85}).toBuffer();const oldMs=Math.round(performance.now()-start);
 start=performance.now();const r=await processTool({toolId:'image-enhance',files:[input]},{outputDir:path.join(work,String(i))});const newMs=Math.round(performance.now()-start),output=await sharp(r.outputs[0]).metadata();
 if(output.isPalette)throw new Error('Enhanced output must not be palette quantized.');
 runs.push({oldMs,newMs,oldBytes:old.length,newBytes:(await fs.stat(r.outputs[0])).size});
}
if(hash(await fs.readFile(input))!==originalHash)throw new Error('Source image changed.');
const median=key=>runs.map(r=>r[key]).sort((a,b)=>a-b)[1];
const result={inputWidth:meta.width,inputHeight:meta.height,inputUnchanged:true,runs,medianOldMs:median('oldMs'),medianNewMs:median('newMs'),notes:'Same local photo, three interleaved trials. This measures processing, not file picking or UI latency. New PNGs preserve full color instead of palette quantization; larger files are expected. Photo content and paths are not included in this report.'};
await fs.writeFile(path.join(root,'docs/verification/enhancement-benchmark.json'),JSON.stringify(result,null,2));console.log(result);
