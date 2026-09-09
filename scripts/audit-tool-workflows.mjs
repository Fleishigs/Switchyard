import fs from "node:fs/promises";
import { tools } from "../shared/catalog.mjs";
const refs = {
  image: [
    "GIMP / Upscayl",
    "https://docs.gimp.org/3.0/en/gimp-image-scale.html",
    "Visible geometry, before/after review, explicit output dimensions; image layers and masks remain outside scope.",
  ],
  audio: [
    "Audacity",
    "https://manual.audacityteam.org/man/audacity_selection.html",
    "Selection readouts, waveform navigation, audition before export; multitrack editing and live effect monitoring remain absent.",
  ],
  video: [
    "LosslessCut / Shotcut",
    "https://github.com/mifi/lossless-cut/blob/master/README.md",
    "Explicit In/Out, zoom, stepping and selected input; multiple segments, stream chooser and keyframe/lossless modes remain absent.",
  ],
  pdf: [
    "PDFsam",
    "https://pdfsam.org/",
    "Visible pages and output order; drag-and-drop page thumbnails across documents remain absent.",
  ],
  text: [
    "CyberChef",
    "https://github.com/gchq/CyberChef",
    "Readable input/output and reusable results; saved multistep recipes remain absent.",
  ],
  engine: [
    "UVR / whisper.cpp",
    "https://github.com/Anjok07/ultimatevocalremovergui",
    "Audition actual source and outputs; synchronized stem mixing and transcript editing remain absent.",
  ],
  download: [
    "yt-dlp",
    "https://github.com/yt-dlp/yt-dlp",
    "Real downloader engine, progress and playable output; preflight format/playlist inspection remains absent.",
  ],
  batch: [
    "Shutter Encoder",
    "https://www.shutterencoder.com/documentation/",
    "Explicit batch targets and per-file failures; conversions remain limited to advertised supported routes.",
  ],
  ocr: [
    "Tesseract",
    "https://github.com/tesseract-ocr/tesseract",
    "Actual recognition and readable result; bounding-box overlays and confidence editing remain absent.",
  ],
};
const specifics = {
  "image-upscale":
    "NEW: actual Upscayl NCNN executable, three trained models, 2×/4× exports, GPU inference, preserved alpha. Requires Vulkan; cannot promise faithful recovery of missing detail.",
  "image-enhance":
    "RENAMED: Adjust photo contrast. It performs contrast/edge adjustment; previous Enhance wording implied an AI restoration it did not perform.",
  "image-resize":
    "Preserves aspect ratio inside a box; independent width/height do not distort. A linked-dimension/percentage control remains desirable.",
  "image-crop":
    "Existing draggable source-coordinate rectangle retained. Draft numbers no longer clamp on every keystroke. Fixed-ratio presets remain absent.",
  "image-contact":
    "Input order now appears in the same order sent to processing; moving a row visibly moves it.",
  "pdf-merge":
    "Explicit ordered inputs replace ambiguous global tray order; result stays beside source/settings.",
  "pdf-images": "Images are selected explicitly and ordered as output pages.",
  "text-diff":
    "Second input remains editable; result additions/removals are colored using the existing diff package.",
  "video-trim":
    "Fixed selected-preview versus actual-export mismatch. Whole clip default, In/Out drafts, frame-rate stepping, timeline zoom/pan, undo and local result playback. Frame stepping uses average frame rate; not exact VFR timestamp navigation.",
  "audio-trim":
    "Whole clip default, In/Out drafts, waveform, zoom/pan, selection playback and selected-only export.",
  "video-gif":
    "Shared In/Out editor enforces a visible 30-second maximum; backend rejects longer requests rather than silently truncating.",
  "voice-vocals":
    "Located under Voice & AI → Separate vocals. Existing real UVR model retained; separate result selector/player for each stem.",
  "voice-transcribe":
    "Existing whisper.cpp retained, source audition and inline transcript output. Default bundled model is English tiny; recognition quality varies.",
  "image-ocr":
    "Fixed the common input filter rejecting OCR images; source preview and extracted text now share a workspace.",
};
const lines = [
  "# Tool workflow review — 2026-09-09",
  "",
  "This is a gap inventory, not a claim of feature parity or exhaustive manual validation. Source branches, catalog options, common input routing and existing decoded-output contracts were reviewed. References describe established workflows; their UI code was not copied. The new shared workspace fixes selection, draft numeric entry, adjustment undo, local results, saving and reuse across normal tools. Converter and Messages retain their dedicated views.",
  "",
  "## Reference expectations",
  "",
];
for (const [kind, [name, url, expectation]] of Object.entries(refs))
  lines.push(`- ${kind}: [${name}](${url}). ${expectation}`);
lines.push(
  "",
  "## Every registered operation",
  "",
  "| Operation | Existing engine / reference | Review and remaining gap |",
  "|---|---|---|",
);
for (const t of tools) {
  const r = refs[t.kind];
  const fields =
    t.options.map((o) => o.label.replaceAll("|", "/")).join(", ") ||
    "recommended defaults";
  const finding =
    specifics[t.id] ||
    `Controls reviewed: ${fields}. ${t.kind === "text" ? "Input and output stay in one workspace; copy and save available." : t.kind === "batch" ? "Dedicated converter uses its format capability table and per-file results." : "Explicit compatible input selection, opt-in batches, and source/result review."} Family-level remaining gaps are listed above.`;
  lines.push(`| ${t.name} (${t.id}) | ${r[0]} | ${finding} |`);
}
lines.push(
  "",
  "## Validation boundaries",
  "",
  "- `outcome-audit.mjs`: 106 decoded-output contracts passed after this change. These check mathematical/media content, not subjective usability.",
  "- `workbench-flows.mjs`: real same-name clip selection, duplicate removal, playback, frame step, timecode entry, export duration, result playback and edit persistence.",
  "- `upscayl-outcomes.mjs`: actual GPU inference for each bundled model; output dimensions and non-resize pixels verified. This is not a photographic quality benchmark.",
  "- `all-tool-runs.mjs`: 106 operations run through actual UI settings and Create result; saved files and continued editor presence checked. Independent output semantics are checked by outcome-audit.\n- `all-workbenches.mjs`: each common workspace opens/closes and routes correctly. This is explicitly not a processing test.",
  "",
  "Remaining work is listed above instead of being hidden behind passing test counts. Messages import/native dialogs passed their separate checks; network downloads, transcription and separation also passed new packaged UI processing and result-playback checks. old UI scripts targeting Run tool/Queue must be migrated to the new workspace.",
);
await fs.writeFile("docs/TOOL-WORKFLOW-AUDIT.md", lines.join("\n") + "\n");
