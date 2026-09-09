import React,{useState,useEffect} from 'react';
export default function DocumentPreview({file,tool,options={},onChange,api}){
  const [page,setPage]=useState(1),[preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>setPage(1),[file]);
  useEffect(()=>{let alive=true;setBusy(true);setError('');api.pdfPreview(file,page).then(p=>{if(alive)setPreview(p);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;};},[file,page,api]);
  const range=['pdf-extract','pdf-delete'].includes(tool?.id),selected=range&&page>=Number(options.start)&&page<=Number(options.end);
  return <section className="document-preview" aria-label="PDF page preview">
    <div className="document-controls"><button className="secondary" aria-label="Previous page" disabled={busy||page===1} onClick={()=>setPage(page-1)}>←</button><label>Page <input type="number" min="1" max={preview?.pages||1} value={page} onChange={e=>setPage(Math.max(1,Math.min(preview?.pages||1,Number(e.target.value)||1)))}/></label><span>of {preview?.pages||'…'}</span><button className="secondary" aria-label="Next page" disabled={busy||!preview||page>=preview.pages} onClick={()=>setPage(page+1)}>→</button></div>
    {error?<p role="alert" className="error">{error}</p>:<div className={'document-sheet'+(selected?' page-selected':'')} aria-busy={busy}>{preview&&<img src={preview.url} alt={`PDF page ${preview.page}`}/>} {busy&&<span role="status">Loading page…</span>}</div>}
    {range&&<div className="document-controls"><button className="secondary" disabled={busy} onClick={()=>onChange({...options,start:page,end:Math.max(page,Number(options.end)||page)})}>Start range here</button><button className="secondary" disabled={busy} onClick={()=>onChange({...options,start:Math.min(page,Number(options.start)||page),end:page})}>End range here</button><small>{selected?(tool.id==='pdf-delete'?'This page will be deleted':'This page will be kept'):'Outside the selected range'}</small></div>}
    {tool&&<p className="media-note">Source pages. Run the tool to create your edited copy.</p>}
  </section>;
}
export function PdfResults({job,api}){
  const [file,setFile]=useState('');const outputs=(job.outputs||[]).filter(p=>/\.pdf$/i.test(p));
  if(!outputs.length)return null;
  return <div className="media-results">{outputs.map(p=><div key={p}><button className="text-button" onClick={()=>setFile(file===p?'':p)}>{file===p?'Hide pages':'Preview PDF'} · {p.split(/[\\/]/).pop()}</button>{file===p&&<DocumentPreview file={p} api={api}/>}</div>)}</div>;
}
