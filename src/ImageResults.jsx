import React,{useEffect,useState} from 'react';
function ResultImage({file,api}){
  const [preview,setPreview]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;api.preview(file).then(p=>{if(alive)setPreview(p);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[file,api]);
  return error?<p role="alert">{error}</p>:preview?<figure className="result-image"><img src={preview.url} alt="Saved image result"/><figcaption>{preview.width} × {preview.height} pixels{/\.gif$/i.test(file)?' · First frame preview':''}</figcaption></figure>:<p role="status">Loading saved image…</p>;
}
export default function ImageResults({job,api}){
  const [open,setOpen]=useState('');const files=(job.outputs||[]).filter(p=>/\.(png|jpe?g|webp|avif|gif|tiff?|bmp)$/i.test(p));
  if(!files.length)return null;
  return <div className="media-results">{files.map(file=><div key={file}><button className="text-button" onClick={()=>setOpen(open===file?'':file)}>{open===file?'Hide image':'View image'} · {file.split(/[\\/]/).pop()}</button>{open===file&&<ResultImage key={file} file={file} api={api}/>}</div>)}</div>;
}
