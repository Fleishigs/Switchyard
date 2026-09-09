import React,{useState} from 'react';
import MediaTimeline,{isMediaTool} from './MediaTimeline.jsx';
import DocumentPreview from './DocumentPreview.jsx';
export default function VisualWorkspace({files,tool,options,onChange,api}){
  const [selected,setSelected]=useState('');
  const file=files.find(f=>f.path===selected)||files[0];if(!file)return null;
  const media=isMediaTool(tool),pdf=tool.kind==='pdf'&&tool.id!=='pdf-images';
  if(!media&&!pdf)return null;
  return <div>{files.length>1&&<label className="preview-file-select">Preview file<select value={file.path} onChange={e=>setSelected(e.target.value)}>{files.map(f=><option key={f.path} value={f.path}>{f.name}</option>)}</select><small>The export settings apply to every file in the tray.</small></label>}{media?<MediaTimeline key={file.path} file={file.path} tool={tool} options={options} onChange={onChange} api={api}/>:<DocumentPreview key={file.path} file={file.path} tool={tool} options={options} onChange={onChange} api={api}/>}</div>;
}
