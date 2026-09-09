import React,{useEffect,useRef,useState} from 'react';
import {Play,Pause,SkipBack,Waveform} from '@phosphor-icons/react';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const stamp=n=>`${Math.floor(n/60)}:${(n%60).toFixed(2).padStart(5,'0')}`;
export const isMediaTool=tool=>['audio','video'].includes(tool?.kind)||['voice-transcribe','voice-vocals'].includes(tool?.id);

export default function MediaTimeline({file,tool,options={},onChange,api}){
  const [info,setInfo]=useState(null),[error,setError]=useState(''),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[ready,setReady]=useState(false);
  const player=useRef(null),selection=useRef(false),frame=useRef(0);
  const trim=['audio-trim','video-trim','video-gif'].includes(tool?.id),capture=tool?.id==='video-frame';
  const fade=['audio-fade-in','audio-fade-out'].includes(tool?.id);
  const duration=info?.duration||1,start=clamp(Number(options.start)||0,0,Math.max(0,duration-.1)),end=clamp(start+(Number(options.duration)||.1),start+.1,duration);
  const bounds=useRef({start,end});bounds.current={start,end};
  useEffect(()=>{
    let alive=true;setInfo(null);setError('');setReady(false);setPosition(0);setPlaying(false);selection.current=false;
    api.mediaPreview(file).then(data=>{if(alive)setInfo(data);}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;cancelAnimationFrame(frame.current);};
  },[file,api]);
  useEffect(()=>{
    if(!info||!trim)return;
    const s=clamp(Number(options.start)||0,0,Math.max(0,info.duration-.1)),d=Number(clamp(Number(options.duration)||.1,.1,info.duration-s).toFixed(6));
    if(s!==options.start||d!==options.duration)onChange({...options,start:s,duration:d});
  },[info,trim,options.start,options.duration]);
  useEffect(()=>{
    if(player.current)player.current.playbackRate=tool?.id?.endsWith('-speed')?clamp(Number(options.speed)||1,.5,2):1;
  },[options.speed,tool?.id,ready]);
  useEffect(()=>{if(capture&&ready&&player.current){player.current.pause();player.current.currentTime=clamp(Number(options.start)||0,0,duration-.01);}},[capture,options.start,ready,duration]);
  const seek=n=>{if(!player.current||!ready)return;selection.current=false;player.current.currentTime=clamp(n,0,duration);setPosition(player.current.currentTime);if(capture)onChange({...options,start:clamp(n,0,duration-.01)});};
  const tick=()=>{const p=player.current;if(!p)return;setPosition(p.currentTime);if(selection.current&&p.currentTime>=bounds.current.end){p.pause();p.currentTime=bounds.current.end;selection.current=false;}if(!p.paused)frame.current=requestAnimationFrame(tick);};
  const play=async selected=>{
    const p=player.current;if(!p||!ready)return;
    try{selection.current=selected;if(selected)p.currentTime=start;else if(p.ended)p.currentTime=0;await p.play();}catch(e){setError('Playback failed: '+e.message);}
  };
  const updateRange=(which,value)=>{
    player.current?.pause();selection.current=false;
    if(which==='start'){const next=clamp(value,0,end-.1);onChange({...options,start:next,duration:Number((end-next).toFixed(6))});seek(next);}
    else{const next=clamp(value,start+.1,duration);onChange({...options,start,duration:Number((next-start).toFixed(6))});seek(Math.max(start,next-.15));}
  };
  const drag=(event,which)=>{
    const node=event.currentTarget,rect=node.parentElement.getBoundingClientRect();node.setPointerCapture(event.pointerId);
    const move=e=>updateRange(which,(e.clientX-rect.left)/rect.width*duration);
    move(event);node.onpointermove=move;node.onpointerup=()=>{node.onpointermove=null;node.onpointerup=null;};
  };
  if(!info)return <div className="media-loading" role={error?'alert':'status'}><Waveform size={24}/>{error||'Reading media and building its waveform…'}</div>;
  const Media=info.video?'video':'audio';
  const max=Math.max(.01,...info.peaks),path=info.peaks.map((p,i)=>`M${i} ${48-p/max*42}V${48+p/max*42}`).join('');
  return <section className="media-workspace" aria-label={tool?'Source media preview':'Processed media preview'}>
    <div className="media-heading"><span>{tool?'Source preview':'Processed result'}</span><strong title={info.name}>{info.name}</strong><small>{stamp(duration)}{info.video?` · ${info.width} × ${info.height}`:''}</small></div>
    <Media ref={player} src={info.url} preload="auto" className={info.video?'media-picture':'media-audio'} playsInline
      onLoadedMetadata={()=>setReady(true)} onError={()=>setError('This codec cannot play in the preview. Use Convert to MP4 or Convert to WAV, then preview that copy.')}
      onPlay={()=>{setPlaying(true);cancelAnimationFrame(frame.current);tick();}} onPause={()=>{setPlaying(false);cancelAnimationFrame(frame.current);setPosition(player.current?.currentTime||0);}}
      onTimeUpdate={()=>setPosition(player.current?.currentTime||0)} onSeeked={()=>setPosition(player.current?.currentTime||0)}/>
    <div className="media-transport">
      <button className="icon-button" aria-label="Back to beginning" disabled={!ready} onClick={()=>seek(0)}><SkipBack size={20}/></button>
      <button className="media-play" aria-label={playing?'Pause preview':'Play preview'} disabled={!ready} onClick={()=>playing?player.current.pause():play(false)}>{playing?<Pause size={20} weight="fill"/>:<Play size={20} weight="fill"/>}</button>
      <output aria-label="Playback position">{stamp(position)} <span>/ {stamp(duration)}</span></output>
      {trim&&<button className="secondary" disabled={!ready} onClick={()=>play(true)}>Play selection</button>}
    </div>
    <div className="media-track">
      <svg viewBox="0 0 800 96" preserveAspectRatio="none" aria-label={info.audio?'Audio waveform':'Video timeline'}><path d={path} stroke="currentColor" strokeWidth=".75"/></svg>
      {fade&&<svg className="fade-envelope" viewBox="0 0 800 96" preserveAspectRatio="none" aria-label="Export fade envelope"><path d={tool.id==='audio-fade-in'?`M0 94 L${Math.min(1,Number(options.duration)/duration)*800} 2 H800`:`M0 2 H${Math.max(0,1-Number(options.duration)/duration)*800} L800 94`} fill="none" stroke="var(--primary)" strokeWidth="3"/></svg>}
      {trim&&<div className="media-selection" style={{left:`${start/duration*100}%`,width:`${(end-start)/duration*100}%`}}/>}
      <input className="media-scrub" type="range" aria-label={capture?'Frame position':'Seek preview'} min="0" max={duration} step="0.01" value={position} disabled={!ready} onChange={e=>seek(Number(e.target.value))}/>
      <div className="media-playhead" style={{left:`${position/duration*100}%`}}/>
      {trim&&<>
        <button role="slider" aria-label="Selection start" aria-valuemin={0} aria-valuemax={end-.1} aria-valuenow={start} aria-valuetext={stamp(start)} className="trim-handle" style={{left:`${start/duration*100}%`}} onPointerDown={e=>drag(e,'start')} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();updateRange('start',e.key==='Home'?0:e.key==='End'?end-.1:start+(e.key==='ArrowLeft'?-.1:.1));}}}>Ⅰ</button>
        <button role="slider" aria-label="Selection end" aria-valuemin={start+.1} aria-valuemax={duration} aria-valuenow={end} aria-valuetext={stamp(end)} className="trim-handle" style={{left:`${end/duration*100}%`}} onPointerDown={e=>drag(e,'end')} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();updateRange('end',e.key==='Home'?start+.1:e.key==='End'?duration:end+(e.key==='ArrowLeft'?-.1:.1));}}}>Ⅰ</button>
      </>}
    </div>
    <div className="media-ruler">{[0,.25,.5,.75,1].map(x=><span key={x}>{stamp(duration*x)}</span>)}</div>
    {fade&&<label className="fade-control">Fade envelope · {Number(options.duration).toFixed(2)} seconds<input type="range" aria-label="Fade duration" min="0.1" max={Math.max(.1,Math.min(120,duration))} step="0.1" value={options.duration} onChange={e=>onChange({...options,duration:Number(e.target.value)})}/><small>The line shows the export envelope; playback here is the original recording.</small></label>}
    {trim&&<p className="media-note">Drag the handles or use arrow keys. Selected: <strong>{stamp(start)} → {stamp(end)}</strong> · {(end-start).toFixed(2)} seconds</p>}
    {tool&&<p className="media-note">{tool.id.endsWith('-speed')?`Listening at ${options.speed}× speed. `:''}{trim?'The selection is exported when you run the tool.':capture?'Scrub to choose the frame to export.':'Run the tool, then play the processed result in Queue & history to hear or see the change.'}</p>}
    {error&&<p role="alert" className="error">{error}</p>}
  </section>;
}

export function MediaResults({job,api}){
  const [open,setOpen]=useState('');
  const files=(job.outputs||[]).filter(p=>/\.(wav|mp3|flac|m4a|aac|opus|ogg|mp4|webm|mov|mkv)$/i.test(p));
  if(!files.length)return null;
  return <div className="media-results">{files.map(file=><div key={file}><button className="text-button" onClick={()=>setOpen(open===file?'':file)}>{open===file?'Hide player':'Play result'} · {file.split(/[\\/]/).pop()}</button>{open===file&&<MediaTimeline file={file} api={api}/>}</div>)}</div>;
}
