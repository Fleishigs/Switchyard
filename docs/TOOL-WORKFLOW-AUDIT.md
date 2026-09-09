# Tool workflow review — 2026-09-09

This is a gap inventory, not a claim of feature parity or exhaustive manual validation. Source branches, catalog options, common input routing and existing decoded-output contracts were reviewed. References describe established workflows; their UI code was not copied. The new shared workspace fixes selection, draft numeric entry, adjustment undo, local results, saving and reuse across normal tools. Converter and Messages retain their dedicated views.

## Reference expectations

- image: [GIMP / Upscayl](https://docs.gimp.org/3.0/en/gimp-image-scale.html). Visible geometry, before/after review, explicit output dimensions; image layers and masks remain outside scope.
- audio: [Audacity](https://manual.audacityteam.org/man/audacity_selection.html). Selection readouts, waveform navigation, audition before export; multitrack editing and live effect monitoring remain absent.
- video: [LosslessCut / Shotcut](https://github.com/mifi/lossless-cut/blob/master/README.md). Explicit In/Out, zoom, stepping and selected input; multiple segments, stream chooser and keyframe/lossless modes remain absent.
- pdf: [PDFsam](https://pdfsam.org/). Visible pages and output order; drag-and-drop page thumbnails across documents remain absent.
- text: [CyberChef](https://github.com/gchq/CyberChef). Readable input/output and reusable results; saved multistep recipes remain absent.
- engine: [UVR / whisper.cpp](https://github.com/Anjok07/ultimatevocalremovergui). Audition actual source and outputs; synchronized stem mixing and transcript editing remain absent.
- download: [yt-dlp](https://github.com/yt-dlp/yt-dlp). Real downloader engine, progress and playable output; preflight format/playlist inspection remains absent.
- batch: [Shutter Encoder](https://www.shutterencoder.com/documentation/). Explicit batch targets and per-file failures; conversions remain limited to advertised supported routes.
- ocr: [Tesseract](https://github.com/tesseract-ocr/tesseract). Actual recognition and readable result; bounding-box overlays and confidence editing remain absent.

## Every registered operation

| Operation | Existing engine / reference | Review and remaining gap |
|---|---|---|
| AI image enhancement (image-upscale) | GIMP / Upscayl | NEW: actual Upscayl NCNN executable, three trained models, 2×/4× exports, GPU inference, preserved alpha. Requires Vulkan; cannot promise faithful recovery of missing detail. |
| Adjust photo contrast (image-enhance) | GIMP / Upscayl | RENAMED: Adjust photo contrast. It performs contrast/edge adjustment; previous Enhance wording implied an AI restoration it did not perform. |
| Resize image (image-resize) | GIMP / Upscayl | Preserves aspect ratio inside a box; independent width/height do not distort. A linked-dimension/percentage control remains desirable. |
| Crop image (image-crop) | GIMP / Upscayl | Existing draggable source-coordinate rectangle retained. Draft numbers no longer clamp on every keystroke. Fixed-ratio presets remain absent. |
| Convert to JPEG (image-jpeg) | GIMP / Upscayl | Controls reviewed: Quality. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to PNG (image-png) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to WebP (image-webp) | GIMP / Upscayl | Controls reviewed: Quality. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to AVIF (image-avif) | GIMP / Upscayl | Controls reviewed: Quality. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Rotate image (image-rotate) | GIMP / Upscayl | Controls reviewed: Angle · degrees. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Flip vertically (image-flip) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Mirror horizontally (image-mirror) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Black & white (image-grayscale) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Blur image (image-blur) | GIMP / Upscayl | Controls reviewed: Blur radius. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Sharpen image (image-sharpen) | GIMP / Upscayl | Controls reviewed: Sharpness. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Adjust brightness (image-brightness) | GIMP / Upscayl | Controls reviewed: Brightness multiplier. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Adjust saturation (image-saturation) | GIMP / Upscayl | Controls reviewed: Saturation multiplier. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Invert colors (image-negative) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Trim image border (image-trim) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Square thumbnail (image-thumbnail) | GIMP / Upscayl | Controls reviewed: Size · pixels. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Add image border (image-border) | GIMP / Upscayl | Controls reviewed: Border · pixels, Border color. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Inspect image (image-metadata) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Remove image metadata (image-strip) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to WAV (audio-wav) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to MP3 (audio-mp3) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to FLAC (audio-flac) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to AAC (audio-aac) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to Opus (audio-opus) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Trim audio (audio-trim) | Audacity | Whole clip default, In/Out drafts, waveform, zoom/pan, selection playback and selected-only export. |
| Normalize loudness (audio-normalize) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Adjust audio gain (audio-volume) | Audacity | Controls reviewed: Gain · dB. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Fade in (audio-fade-in) | Audacity | Controls reviewed: Fade · seconds. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Fade out (audio-fade-out) | Audacity | Controls reviewed: Fade · seconds. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Reverse audio (audio-reverse) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Change audio speed (audio-speed) | Audacity | Controls reviewed: Speed multiplier. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to mono (audio-mono) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Reduce steady noise (audio-denoise) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Remove low rumble (audio-highpass) | Audacity | Controls reviewed: Cutoff · Hz. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Low-pass audio (audio-lowpass) | Audacity | Controls reviewed: Cutoff · Hz. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Trim leading silence (audio-silence) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Inspect media (audio-inspect) | Audacity | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to MP4 (video-mp4) | LosslessCut / Shotcut | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Convert to WebM (video-webm) | LosslessCut / Shotcut | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Trim video (video-trim) | LosslessCut / Shotcut | Fixed selected-preview versus actual-export mismatch. Whole clip default, In/Out drafts, frame-rate stepping, timeline zoom/pan, undo and local result playback. Frame stepping uses average frame rate; not exact VFR timestamp navigation. |
| Remove video audio (video-mute) | LosslessCut / Shotcut | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Extract audio (video-extract) | LosslessCut / Shotcut | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Resize video (video-resize) | LosslessCut / Shotcut | Controls reviewed: Width · pixels. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Compress video (video-compress) | LosslessCut / Shotcut | Controls reviewed: CRF · lower is higher quality. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Video to GIF (video-gif) | LosslessCut / Shotcut | Shared In/Out editor enforces a visible 30-second maximum; backend rejects longer requests rather than silently truncating. |
| Extract video frame (video-frame) | LosslessCut / Shotcut | Controls reviewed: Position · seconds. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Rotate video (video-rotate) | LosslessCut / Shotcut | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Mirror video (video-mirror) | LosslessCut / Shotcut | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Change video speed (video-speed) | LosslessCut / Shotcut | Controls reviewed: Speed multiplier. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Merge PDFs (pdf-merge) | PDFsam | Explicit ordered inputs replace ambiguous global tray order; result stays beside source/settings. |
| Extract PDF pages (pdf-extract) | PDFsam | Controls reviewed: First page, Last page. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Rotate PDF pages (pdf-rotate) | PDFsam | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Reverse PDF pages (pdf-reverse) | PDFsam | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Inspect PDF (pdf-metadata) | PDFsam | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Images to PDF (pdf-images) | PDFsam | Images are selected explicitly and ordered as output pages. |
| Text statistics (text-stats) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Uppercase (text-upper) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Lowercase (text-lower) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Title case (text-title) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| URL slug (text-slug) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Sort lines (text-sort) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Deduplicate lines (text-unique) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Clean whitespace (text-trim) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Format JSON (text-json) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Minify JSON (text-json-min) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Encode Base64 (text-base64) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Decode Base64 (text-unbase64) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| URL encode (text-url) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| URL decode (text-unurl) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| SHA-256 hash (text-sha256) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Generate UUIDs (text-uuid) | CyberChef | Controls reviewed: Count. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Generate password (text-password) | CyberChef | Controls reviewed: Length. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Create QR code (text-qr) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Download video (download-video) | yt-dlp | Controls reviewed: Video URL. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Download audio (download-audio) | yt-dlp | Controls reviewed: Video URL. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Local transcription (voice-transcribe) | UVR / whisper.cpp | Existing whisper.cpp retained, source audition and inline transcript output. Default bundled model is English tiny; recognition quality varies. |
| Separate vocals (voice-vocals) | UVR / whisper.cpp | Located under Voice & AI → Separate vocals. Existing real UVR model retained; separate result selector/player for each stem. |
| Batch file converter (batch-convert) | Shutter Encoder | Controls reviewed: recommended defaults. Dedicated converter uses its format capability table and per-file results. Family-level remaining gaps are listed above. |
| Pixelate image (image-pixelate) | GIMP / Upscayl | Controls reviewed: Pixel block size. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Tint image (image-tint) | GIMP / Upscayl | Controls reviewed: Tint color. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Threshold image (image-threshold) | GIMP / Upscayl | Controls reviewed: Threshold. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Round image corners (image-rounded) | GIMP / Upscayl | Controls reviewed: Corner radius · pixels. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Make contact sheet (image-contact) | GIMP / Upscayl | Input order now appears in the same order sent to processing; moving a row visibly moves it. |
| Watermark image (image-watermark) | GIMP / Upscayl | Controls reviewed: Watermark text, Opacity. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Extract color palette (image-palette) | GIMP / Upscayl | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Split PDF pages (pdf-split) | PDFsam | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Delete PDF pages (pdf-delete) | PDFsam | Controls reviewed: First page to remove, Last page to remove. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Number PDF pages (pdf-number) | PDFsam | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Watermark PDF (pdf-watermark) | PDFsam | Controls reviewed: Watermark text. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Extract PDF text (pdf-text) | PDFsam | Controls reviewed: recommended defaults. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| PDF pages to PNG (pdf-render) | PDFsam | Controls reviewed: Resolution scale. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| Edit PDF information (pdf-edit-info) | PDFsam | Controls reviewed: Document title, Author. Explicit compatible input selection, opt-in batches, and source/result review. Family-level remaining gaps are listed above. |
| CSV to JSON (text-csv-json) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| JSON to CSV (text-json-csv) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Escape HTML (text-html-escape) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Unescape HTML (text-html-unescape) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Number text lines (text-number-lines) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Find and replace (text-replace) | CyberChef | Controls reviewed: Find, Replace with. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Compare two texts (text-diff) | CyberChef | Second input remains editable; result additions/removals are colored using the existing diff package. |
| Inspect JWT (text-jwt) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Text to PDF (text-pdf) | CyberChef | Controls reviewed: recommended defaults. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Length converter (unit-length) | CyberChef | Controls reviewed: Value, From unit. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Mass converter (unit-mass) | CyberChef | Controls reviewed: Value, From unit. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Temperature converter (unit-temperature) | CyberChef | Controls reviewed: Value, From unit. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Data size converter (unit-storage) | CyberChef | Controls reviewed: Value, From unit. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Date difference (date-distance) | CyberChef | Controls reviewed: Start date · YYYY-MM-DD, End date · YYYY-MM-DD. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Number base converter (number-base) | CyberChef | Controls reviewed: Integer, Input base. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Color inspector (color-inspect) | CyberChef | Controls reviewed: Hex color. Input and output stay in one workspace; copy and save available. Family-level remaining gaps are listed above. |
| Read text from image (image-ocr) | Tesseract | Fixed the common input filter rejecting OCR images; source preview and extracted text now share a workspace. |

## Validation boundaries

- `outcome-audit.mjs`: 106 decoded-output contracts passed after this change. These check mathematical/media content, not subjective usability.
- `workbench-flows.mjs`: real same-name clip selection, duplicate removal, playback, frame step, timecode entry, export duration, result playback and edit persistence.
- `upscayl-outcomes.mjs`: actual GPU inference for each bundled model; output dimensions and non-resize pixels verified. This is not a photographic quality benchmark.
- `all-tool-runs.mjs`: 106 operations run through actual UI settings and Create result; saved files and continued editor presence checked. Independent output semantics are checked by outcome-audit.
- `all-workbenches.mjs`: each common workspace opens/closes and routes correctly. This is explicitly not a processing test.

Remaining work is listed above instead of being hidden behind passing test counts. Messages import/native dialogs passed their separate checks; network downloads, transcription and separation also passed new packaged UI processing and result-playback checks. old UI scripts targeting Run tool/Queue must be migrated to the new workspace.
