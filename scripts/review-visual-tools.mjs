import fs from 'node:fs/promises';
import {tools} from '../shared/catalog.mjs';
const special={
 'audio-trim':'Playable waveform, scrubbing, draggable/keyboard In and Out handles, selection playback, numeric bounds, saved-result player.',
 'video-trim':'Visible video, waveform, scrubbing, draggable/keyboard In and Out handles, selection playback, numeric bounds, saved-result player.',
 'video-gif':'Video selection timeline and playback before export. Saved GIF currently previews its first frame; open the saved file for animation.',
 'video-frame':'Visible video with a frame-position scrubber synchronized to the export time; saved PNG preview.',
 'audio-fade-in':'Waveform with a visual export envelope and fade-duration slider; original playback and processed-result playback.',
 'audio-fade-out':'Waveform with a visual export envelope and fade-duration slider; original playback and processed-result playback.',
 'audio-speed':'Source playback at the selected rate with preserved pitch; processed-result playback.',
 'audio-inspect':'Playable source waveform and readable stream, codec, duration and sample-rate information. This inspection tool does not create a new audio file.',
 'video-speed':'Video playback at the selected rate; processed-result playback.',
 'voice-vocals':'Source waveform and playback; separate named players for vocal and instrumental output. Located in Voice & AI.',
 'voice-transcribe':'Source waveform and playback plus transcript text and subtitle export. Word-synchronized highlighting is not implemented.',
 'image-crop':'Actual image with draggable crop rectangle and synchronized pixel bounds; before/after and saved-image previews.',
 'image-metadata':'Source image plus readable dimensions and metadata.',
 'image-palette':'Source image plus extracted palette values; clickable swatches remain a useful follow-up.',
 'image-contact':'Source image, tray ordering, saved contact-sheet preview. A live multi-image sheet layout remains a useful follow-up.',
 'pdf-images':'Tray ordering and saved PDF page viewer. A live input thumbnail sequence remains a useful follow-up.',
 'pdf-merge':'Preview any input PDF, navigate pages, reorder the tray before opening the tool; inspect the merged PDF in-app.',
 'pdf-extract':'Navigate actual pages and set the first/last page from the preview. Selected pages are outlined. Saved PDF page viewer.',
 'pdf-delete':'Navigate actual pages and set deletion bounds from the preview. Selected pages are outlined and labeled for deletion. Saved PDF page viewer.',
 'text-diff':'Two multiline text inputs and line-by-line diff output. Colored side-by-side diff remains a useful follow-up.',
 'text-qr':'Text input and a decoded, visible saved QR image. A timeline would not help this tool.',
 'batch-convert':'Per-file destination matrix, compatibility feedback, tray ordering, and image/media/PDF result viewers. Specialized mesh/font/database viewers are not implemented.',
 'download-video':'URL input with progress and a player for the downloaded video.',
 'download-audio':'URL input with progress and a waveform/player for the downloaded audio.'
};
function review(t){return special[t.id]||({image:'Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview.',audio:'Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied.',video:'Visible source playback and waveform/scrubbing; processed video/audio/image result viewers.',pdf:'Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation.',text:'Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document.',engine:'Source/output review appropriate to the engine; no decorative progress used as evidence of correctness.',batch:'File and destination matrix with result feedback.'}[t.kind]||'Readable inputs and results; no spatial or time-based manipulation needed.');}
const rows=tools.map(t=>({id:t.id,name:t.name,category:t.category,review:review(t)}));
await fs.writeFile('docs/VISUAL-TOOL-REVIEW.md','# Visual review of every Switchyard tool\n\nAll '+rows.length+' registered tools were classified by what the user needs to inspect. This records the implemented perspective and remaining opportunities, not a claim that every possible preview has been built.\n\nThe main changes are playable audio/video timelines, selection handles, result players, PDF page navigation/range controls, image results, multiline comparison input, and tray ordering. Shared components give each applicable tool the same controls.\n\n| Tool | Visual perspective |\n| --- | --- |\n'+rows.map(t=>`| ${t.name} (\`${t.id}\`) | ${t.review} |`).join('\n')+'\n');
console.log('Reviewed '+rows.length+' tools');
