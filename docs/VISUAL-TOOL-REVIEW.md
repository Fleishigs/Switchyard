# Visual review of every Switchyard tool

All 111 registered tools were classified by what the user needs to inspect. This records the implemented perspective and remaining opportunities, not a claim that every possible preview has been built.

The main changes are playable audio/video timelines, selection handles, result players, PDF page navigation/range controls, image results, multiline comparison input, and tray ordering. Shared components give each applicable tool the same controls.

| Tool | Visual perspective |
| --- | --- |
| Enhance image (`image-enhance`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Resize image (`image-resize`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Crop image (`image-crop`) | Actual image with draggable crop rectangle and synchronized pixel bounds; before/after and saved-image previews. |
| Convert to JPEG (`image-jpeg`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Convert to PNG (`image-png`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Convert to WebP (`image-webp`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Convert to AVIF (`image-avif`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Rotate image (`image-rotate`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Flip vertically (`image-flip`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Mirror horizontally (`image-mirror`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Black & white (`image-grayscale`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Blur image (`image-blur`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Sharpen image (`image-sharpen`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Adjust brightness (`image-brightness`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Adjust saturation (`image-saturation`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Invert colors (`image-negative`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Trim image border (`image-trim`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Square thumbnail (`image-thumbnail`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Add image border (`image-border`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Inspect image (`image-metadata`) | Source image plus readable dimensions and metadata. |
| Remove image metadata (`image-strip`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Convert to WAV (`audio-wav`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Convert to MP3 (`audio-mp3`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Convert to FLAC (`audio-flac`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Convert to AAC (`audio-aac`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Convert to Opus (`audio-opus`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Trim audio (`audio-trim`) | Playable waveform, scrubbing, draggable/keyboard In and Out handles, selection playback, numeric bounds, saved-result player. |
| Normalize loudness (`audio-normalize`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Adjust audio gain (`audio-volume`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Fade in (`audio-fade-in`) | Waveform with a visual export envelope and fade-duration slider; original playback and processed-result playback. |
| Fade out (`audio-fade-out`) | Waveform with a visual export envelope and fade-duration slider; original playback and processed-result playback. |
| Reverse audio (`audio-reverse`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Change audio speed (`audio-speed`) | Source playback at the selected rate with preserved pitch; processed-result playback. |
| Convert to mono (`audio-mono`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Reduce steady noise (`audio-denoise`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Remove low rumble (`audio-highpass`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Low-pass audio (`audio-lowpass`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Trim leading silence (`audio-silence`) | Playable source waveform with scrubbing; processed-result player. The original is explicitly labeled, so previewing it does not imply the effect has been applied. |
| Inspect media (`audio-inspect`) | Playable source waveform and readable stream, codec, duration and sample-rate information. This inspection tool does not create a new audio file. |
| Convert to MP4 (`video-mp4`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Convert to WebM (`video-webm`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Trim video (`video-trim`) | Visible video, waveform, scrubbing, draggable/keyboard In and Out handles, selection playback, numeric bounds, saved-result player. |
| Remove video audio (`video-mute`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Extract audio (`video-extract`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Resize video (`video-resize`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Compress video (`video-compress`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Video to GIF (`video-gif`) | Video selection timeline and playback before export. Saved GIF currently previews its first frame; open the saved file for animation. |
| Extract video frame (`video-frame`) | Visible video with a frame-position scrubber synchronized to the export time; saved PNG preview. |
| Rotate video (`video-rotate`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Mirror video (`video-mirror`) | Visible source playback and waveform/scrubbing; processed video/audio/image result viewers. |
| Change video speed (`video-speed`) | Video playback at the selected rate; processed-result playback. |
| Merge PDFs (`pdf-merge`) | Preview any input PDF, navigate pages, reorder the tray before opening the tool; inspect the merged PDF in-app. |
| Extract PDF pages (`pdf-extract`) | Navigate actual pages and set the first/last page from the preview. Selected pages are outlined. Saved PDF page viewer. |
| Rotate PDF pages (`pdf-rotate`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Reverse PDF pages (`pdf-reverse`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Inspect PDF (`pdf-metadata`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Images to PDF (`pdf-images`) | Tray ordering and saved PDF page viewer. A live input thumbnail sequence remains a useful follow-up. |
| Text statistics (`text-stats`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Uppercase (`text-upper`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Lowercase (`text-lower`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Title case (`text-title`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| URL slug (`text-slug`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Sort lines (`text-sort`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Deduplicate lines (`text-unique`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Clean whitespace (`text-trim`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Format JSON (`text-json`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Minify JSON (`text-json-min`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Encode Base64 (`text-base64`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Decode Base64 (`text-unbase64`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| URL encode (`text-url`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| URL decode (`text-unurl`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| SHA-256 hash (`text-sha256`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Generate UUIDs (`text-uuid`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Generate password (`text-password`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Create QR code (`text-qr`) | Text input and a decoded, visible saved QR image. A timeline would not help this tool. |
| Download video (`download-video`) | URL input with progress and a player for the downloaded video. |
| Download audio (`download-audio`) | URL input with progress and a waveform/player for the downloaded audio. |
| Local transcription (`voice-transcribe`) | Source waveform and playback plus transcript text and subtitle export. Word-synchronized highlighting is not implemented. |
| Separate vocals (`voice-vocals`) | Source waveform and playback; separate named players for vocal and instrumental output. Located in Voice & AI. |
| Batch file converter (`batch-convert`) | Per-file destination matrix, compatibility feedback, tray ordering, and image/media/PDF result viewers. Specialized mesh/font/database viewers are not implemented. |
| Pixelate image (`image-pixelate`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Tint image (`image-tint`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Threshold image (`image-threshold`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Round image corners (`image-rounded`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Make contact sheet (`image-contact`) | Source image, tray ordering, saved contact-sheet preview. A live multi-image sheet layout remains a useful follow-up. |
| Watermark image (`image-watermark`) | Source image preview, saved image viewer, and before/after comparison for image outputs. Effects are evaluated after processing; this is not a live effect preview. |
| Extract color palette (`image-palette`) | Source image plus extracted palette values; clickable swatches remain a useful follow-up. |
| Split PDF pages (`pdf-split`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Delete PDF pages (`pdf-delete`) | Navigate actual pages and set deletion bounds from the preview. Selected pages are outlined and labeled for deletion. Saved PDF page viewer. |
| Number PDF pages (`pdf-number`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Watermark PDF (`pdf-watermark`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Extract PDF text (`pdf-text`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| PDF pages to PNG (`pdf-render`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| Edit PDF information (`pdf-edit-info`) | Actual source page viewer with navigation and saved PDF/image/text results appropriate to the operation. |
| CSV to JSON (`text-csv-json`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| JSON to CSV (`text-json-csv`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Escape HTML (`text-html-escape`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Unescape HTML (`text-html-unescape`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Number text lines (`text-number-lines`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Find and replace (`text-replace`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Compare two texts (`text-diff`) | Two multiline text inputs and line-by-line diff output. Colored side-by-side diff remains a useful follow-up. |
| Inspect JWT (`text-jwt`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Text to PDF (`text-pdf`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Length converter (`unit-length`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Mass converter (`unit-mass`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Temperature converter (`unit-temperature`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Data size converter (`unit-storage`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Date difference (`date-distance`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Number base converter (`number-base`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Color inspector (`color-inspect`) | Editable text/options and readable, copyable output. Use the saved PDF or image viewer when this tool creates a visual document. |
| Read text from image (`image-ocr`) | Readable inputs and results; no spatial or time-based manipulation needed. |
