const field = (key, label, value, min, max) => ({
  key,
  label,
  value,
  min,
  max,
  type: "number",
});
const select = (key, label, value, options) => ({
  key,
  label,
  value,
  options,
  type: "select",
});
const text = (key, label, value = "") => ({ key, label, value, type: "text" });
const size = [
  field("width", "Width · pixels", 1600, 1, 16000),
  field("height", "Height · pixels", 1200, 1, 16000),
];
const quality = [field("quality", "Quality", 85, 1, 100)];
const time = [
  field("start", "Start · seconds", 0, 0, 86400),
  field("duration", "Duration · seconds", 10, 0.1, 86400),
];
export const tools = [];
function add(category, kind, rows) {
  for (const [id, name, description, options = []] of rows)
    tools.push({ id, name, description, category, kind, options });
}
add("Images", "image", [
  [
    "image-enhance",
    "Enhance image",
    "Balance contrast and sharpen fine detail. Conventional enhancement, without invented AI detail.",
  ],
  [
    "image-resize",
    "Resize image",
    "Fit your image inside exact pixel dimensions.",
    size,
  ],
  [
    "image-crop",
    "Crop image",
    "Extract a precise rectangle from the source.",
    [
      field("left", "Left · pixels", 0, 0, 16000),
      field("top", "Top · pixels", 0, 0, 16000),
      ...size,
    ],
  ],
  [
    "image-jpeg",
    "Convert to JPEG",
    "Compact photographs with adjustable quality.",
    quality,
  ],
  ["image-png", "Convert to PNG", "Lossless images with transparency."],
  [
    "image-webp",
    "Convert to WebP",
    "Modern compressed images with transparency.",
    quality,
  ],
  [
    "image-avif",
    "Convert to AVIF",
    "Highly compressed images for the web.",
    quality,
  ],
  [
    "image-rotate",
    "Rotate image",
    "Turn an image by a chosen angle.",
    [field("angle", "Angle · degrees", 90, -360, 360)],
  ],
  ["image-flip", "Flip vertically", "Reflect an image from top to bottom."],
  [
    "image-mirror",
    "Mirror horizontally",
    "Reflect an image from left to right.",
  ],
  ["image-grayscale", "Black & white", "Convert color to grayscale."],
  [
    "image-blur",
    "Blur image",
    "Apply a smooth Gaussian blur.",
    [field("sigma", "Blur radius", 3, 0.3, 100)],
  ],
  [
    "image-sharpen",
    "Sharpen image",
    "Bring edges and fine detail into focus.",
    [field("sigma", "Sharpness", 1, 0.1, 10)],
  ],
  [
    "image-brightness",
    "Adjust brightness",
    "Brighten or darken with a multiplier.",
    [field("amount", "Brightness multiplier", 1.2, 0.1, 3)],
  ],
  [
    "image-saturation",
    "Adjust saturation",
    "Control the strength of color.",
    [field("amount", "Saturation multiplier", 1.3, 0, 3)],
  ],
  ["image-negative", "Invert colors", "Create a photographic negative."],
  ["image-trim", "Trim image border", "Remove a uniform outer border."],
  [
    "image-thumbnail",
    "Square thumbnail",
    "Center-crop an avatar or cover image.",
    [field("width", "Size · pixels", 512, 16, 4096)],
  ],
  [
    "image-border",
    "Add image border",
    "Frame an image with a solid-color border.",
    [
      field("width", "Border · pixels", 24, 1, 1000),
      text("color", "Border color", "#ffffff"),
    ],
  ],
  [
    "image-metadata",
    "Inspect image",
    "Read dimensions, format, channels, and metadata.",
  ],
  [
    "image-strip",
    "Remove image metadata",
    "Re-encode to PNG without EXIF or GPS metadata.",
  ],
]);
add("Audio", "audio", [
  ["audio-wav", "Convert to WAV", "Uncompressed PCM audio at 48 kHz."],
  ["audio-mp3", "Convert to MP3", "Portable 192 kbps audio."],
  ["audio-flac", "Convert to FLAC", "Lossless audio compression."],
  ["audio-aac", "Convert to AAC", "Compact audio in an M4A container."],
  ["audio-opus", "Convert to Opus", "Efficient audio for speech and music."],
  ["audio-trim", "Trim audio", "Export a selected time range.", time],
  [
    "audio-normalize",
    "Normalize loudness",
    "Target -16 LUFS with a -1.5 dB true-peak ceiling.",
  ],
  [
    "audio-volume",
    "Adjust audio gain",
    "Raise or lower the level in decibels.",
    [field("gain", "Gain · dB", -3, -60, 24)],
  ],
  [
    "audio-fade-in",
    "Fade in",
    "Make the beginning fade in smoothly.",
    [field("duration", "Fade · seconds", 2, 0.1, 120)],
  ],
  [
    "audio-fade-out",
    "Fade out",
    "Fade the final seconds of a recording.",
    [field("duration", "Fade · seconds", 2, 0.1, 120)],
  ],
  ["audio-reverse", "Reverse audio", "Play a recording backwards."],
  [
    "audio-speed",
    "Change audio speed",
    "Adjust duration while preserving pitch.",
    [field("speed", "Speed multiplier", 1.25, 0.5, 2)],
  ],
  ["audio-mono", "Convert to mono", "Mix channels down to one channel."],
  [
    "audio-denoise",
    "Reduce steady noise",
    "Frequency-domain noise reduction for steady background noise.",
  ],
  [
    "audio-highpass",
    "Remove low rumble",
    "Cut low-frequency rumble.",
    [field("frequency", "Cutoff · Hz", 80, 20, 1000)],
  ],
  [
    "audio-lowpass",
    "Low-pass audio",
    "Soften high frequencies.",
    [field("frequency", "Cutoff · Hz", 8000, 100, 20000)],
  ],
  [
    "audio-silence",
    "Trim leading silence",
    "Remove silence before the first audible sound.",
  ],
  [
    "audio-inspect",
    "Inspect media",
    "Read codec, streams, duration and format information.",
  ],
]);
add("Video", "video", [
  [
    "video-mp4",
    "Convert to MP4",
    "H.264 video and AAC audio for broad compatibility.",
  ],
  ["video-webm", "Convert to WebM", "VP9 video and Opus audio."],
  [
    "video-trim",
    "Trim video",
    "Export a selected range with accurate re-encoding.",
    time,
  ],
  ["video-mute", "Remove video audio", "Create a silent copy of a video."],
  ["video-extract", "Extract audio", "Save a video soundtrack as WAV."],
  [
    "video-resize",
    "Resize video",
    "Scale to a chosen width with even dimensions.",
    [field("width", "Width · pixels", 1280, 16, 7680)],
  ],
  [
    "video-compress",
    "Compress video",
    "Reduce video bitrate with a quality target.",
    [field("crf", "CRF · lower is higher quality", 28, 18, 40)],
  ],
  [
    "video-gif",
    "Video to GIF",
    "Turn a short clip into an animated GIF.",
    time,
  ],
  [
    "video-frame",
    "Extract video frame",
    "Save one frame as a PNG.",
    [field("start", "Position · seconds", 1, 0, 86400)],
  ],
  ["video-rotate", "Rotate video", "Rotate clockwise by 90 degrees."],
  ["video-mirror", "Mirror video", "Flip video horizontally."],
  [
    "video-speed",
    "Change video speed",
    "Speed up or slow down picture and audio together.",
    [field("speed", "Speed multiplier", 1.25, 0.5, 2)],
  ],
]);
add("Documents", "pdf", [
  [
    "pdf-merge",
    "Merge PDFs",
    "Combine files in the order shown in the file tray.",
  ],
  [
    "pdf-extract",
    "Extract PDF pages",
    "Save a page range to a new PDF.",
    [
      field("start", "First page", 1, 1, 100000),
      field("end", "Last page", 1, 1, 100000),
    ],
  ],
  [
    "pdf-rotate",
    "Rotate PDF pages",
    "Rotate all pages clockwise by 90 degrees.",
  ],
  ["pdf-reverse", "Reverse PDF pages", "Reverse the order of pages."],
  ["pdf-metadata", "Inspect PDF", "Read page count and document information."],
  ["pdf-images", "Images to PDF", "Make one PDF page per image in tray order."],
]);
add("Text & code", "text", [
  [
    "text-stats",
    "Text statistics",
    "Count words, characters, lines, and reading time.",
  ],
  ["text-upper", "Uppercase", "Convert text to uppercase."],
  ["text-lower", "Lowercase", "Convert text to lowercase."],
  ["text-title", "Title case", "Capitalize the first letter of each word."],
  ["text-slug", "URL slug", "Make a clean lowercase URL slug."],
  ["text-sort", "Sort lines", "Sort lines alphabetically."],
  [
    "text-unique",
    "Deduplicate lines",
    "Keep the first occurrence of each line.",
  ],
  ["text-trim", "Clean whitespace", "Trim lines and remove blank lines."],
  ["text-json", "Format JSON", "Validate JSON and pretty-print it."],
  [
    "text-json-min",
    "Minify JSON",
    "Validate JSON and remove insignificant spaces.",
  ],
  ["text-base64", "Encode Base64", "Encode Unicode text as Base64."],
  ["text-unbase64", "Decode Base64", "Decode Base64 into UTF-8 text."],
  ["text-url", "URL encode", "Encode a URL component."],
  ["text-unurl", "URL decode", "Decode a URL component."],
  ["text-sha256", "SHA-256 hash", "Compute a SHA-256 digest of text."],
  [
    "text-uuid",
    "Generate UUIDs",
    "Generate cryptographically random UUIDs.",
    [field("count", "Count", 10, 1, 1000)],
  ],
  [
    "text-password",
    "Generate password",
    "Generate a random password locally.",
    [field("length", "Length", 24, 8, 256)],
  ],
  ["text-qr", "Create QR code", "Encode text or a URL as a PNG QR code."],
]);
add("Downloads", "download", [
  [
    "download-video",
    "Download video",
    "Download a public video URL with yt-dlp.",
    [text("url", "Video URL")],
  ],
  [
    "download-audio",
    "Download audio",
    "Download and extract a public video soundtrack as MP3.",
    [text("url", "Video URL")],
  ],
]);
add("Voice & AI", "engine", [
  [
    "voice-transcribe",
    "Local transcription",
    "Transcribe an audio file using whisper.cpp on your CPU.",
  ],
  [
    "voice-vocals",
    "Separate vocals",
    "Create vocal and instrumental stems with a UVR model.",
  ],
]);
add("Everyday", "batch", [
  [
    "batch-convert",
    "Batch file converter",
    "Convert mixed files with a compatible destination for each file.",
  ],
]);
add("Images", "image", [
  [
    "image-pixelate",
    "Pixelate image",
    "Create a deliberate block-pixel effect.",
    [field("block", "Pixel block size", 16, 2, 128)],
  ],
  [
    "image-tint",
    "Tint image",
    "Map an image to a chosen color.",
    [text("color", "Tint color", "#558866")],
  ],
  [
    "image-threshold",
    "Threshold image",
    "Create a crisp two-tone black and white image.",
    [field("threshold", "Threshold", 128, 0, 255)],
  ],
  [
    "image-rounded",
    "Round image corners",
    "Export transparent rounded corners.",
    [field("radius", "Corner radius · pixels", 80, 1, 4000)],
  ],
  [
    "image-contact",
    "Make contact sheet",
    "Arrange a batch of images into a single overview.",
    [
      field("columns", "Columns", 3, 1, 10),
      field("width", "Thumbnail width", 320, 64, 1000),
    ],
  ],
  [
    "image-watermark",
    "Watermark image",
    "Add your own text at the bottom of an image.",
    [
      text("label", "Watermark text", "Switchyard"),
      field("opacity", "Opacity", 0.65, 0.1, 1),
    ],
  ],
  [
    "image-palette",
    "Extract color palette",
    "Find the most common color groups in an image.",
  ],
]);
add("Documents", "pdf", [
  ["pdf-split", "Split PDF pages", "Save each page as a separate PDF."],
  [
    "pdf-delete",
    "Delete PDF pages",
    "Remove a page range from a new copy.",
    [
      field("start", "First page to remove", 1, 1, 100000),
      field("end", "Last page to remove", 1, 1, 100000),
    ],
  ],
  ["pdf-number", "Number PDF pages", "Add a small page number to every page."],
  [
    "pdf-watermark",
    "Watermark PDF",
    "Stamp every page with a translucent text watermark.",
    [text("label", "Watermark text", "DRAFT")],
  ],
  [
    "pdf-text",
    "Extract PDF text",
    "Read embedded text from PDFs. Scanned pages require OCR.",
  ],
  [
    "pdf-render",
    "PDF pages to PNG",
    "Render each page as a sharp PNG image.",
    [field("scale", "Resolution scale", 1.5, 0.5, 3)],
  ],
  [
    "pdf-edit-info",
    "Edit PDF information",
    "Set the document title and author in a new copy.",
    [text("title", "Document title", "Untitled"), text("author", "Author")],
  ],
]);
add("Text & code", "text", [
  [
    "text-csv-json",
    "CSV to JSON",
    "Parse quoted CSV fields into JSON objects.",
  ],
  [
    "text-json-csv",
    "JSON to CSV",
    "Convert an array of objects into a quoted CSV table.",
  ],
  [
    "text-html-escape",
    "Escape HTML",
    "Encode text for safe display inside HTML.",
  ],
  [
    "text-html-unescape",
    "Unescape HTML",
    "Decode numeric and common named HTML entities.",
  ],
  [
    "text-number-lines",
    "Number text lines",
    "Add a line number to every line.",
  ],
  [
    "text-replace",
    "Find and replace",
    "Replace literal text without regular-expression surprises.",
    [
      text("find", "Find", "Switchyard"),
      text("replacement", "Replace with", "Workshop"),
    ],
  ],
  [
    "text-diff",
    "Compare two texts",
    "Generate a line-by-line diff.",
    [text("other", "Second text", "Hello Workshop")],
  ],
  [
    "text-jwt",
    "Inspect JWT",
    "Decode header and claims locally. Does not verify the signature.",
  ],
  [
    "text-pdf",
    "Text to PDF",
    "Create a paginated PDF from plain text. Uses the built-in Latin font.",
  ],
]);
add("Everyday", "text", [
  [
    "unit-length",
    "Length converter",
    "Convert meters, kilometers, feet, inches, and miles.",
    [
      field("value", "Value", 1, -1e12, 1e12),
      select("unit", "From unit", "meters", [
        "meters",
        "kilometers",
        "feet",
        "inches",
        "miles",
      ]),
    ],
  ],
  [
    "unit-mass",
    "Mass converter",
    "Convert kilograms, grams, pounds, and ounces.",
    [
      field("value", "Value", 1, 0, 1e12),
      select("unit", "From unit", "kilograms", [
        "kilograms",
        "grams",
        "pounds",
        "ounces",
      ]),
    ],
  ],
  [
    "unit-temperature",
    "Temperature converter",
    "Convert Celsius, Fahrenheit, and Kelvin.",
    [
      field("value", "Value", 20, -10000, 1e8),
      select("unit", "From unit", "Celsius", [
        "Celsius",
        "Fahrenheit",
        "Kelvin",
      ]),
    ],
  ],
  [
    "unit-storage",
    "Data size converter",
    "Compare decimal and binary storage units.",
    [
      field("value", "Value", 1, 0, 1e15),
      select("unit", "From unit", "GB", [
        "bytes",
        "KB",
        "MB",
        "GB",
        "KiB",
        "MiB",
        "GiB",
      ]),
    ],
  ],
  [
    "date-distance",
    "Date difference",
    "Count the calendar days between two ISO dates.",
    [
      text("from", "Start date · YYYY-MM-DD", "2026-01-01"),
      text("to", "End date · YYYY-MM-DD", "2026-12-31"),
    ],
  ],
  [
    "number-base",
    "Number base converter",
    "Convert integers between binary, decimal and hexadecimal.",
    [
      text("value", "Integer", "255"),
      select("base", "Input base", "10", ["2", "10", "16"]),
    ],
  ],
  [
    "color-inspect",
    "Color inspector",
    "Convert a hex color to RGB and HSL and calculate contrast with white and black.",
    [text("color", "Hex color", "#356347")],
  ],
]);
add("Images", "ocr", [
  [
    "image-ocr",
    "Read text from image",
    "Extract printed English text using local OCR. No upload.",
  ],
]);
export const categories = [...new Set(tools.map((t) => t.category))];
export const toolById = Object.fromEntries(tools.map((t) => [t.id, t]));
export function defaults(tool) {
  return Object.fromEntries(tool.options.map((o) => [o.key, o.value]));
}
export function validateOptions(tool, input = {}) {
  const result = defaults(tool);
  for (const o of tool.options) {
    const v = input[o.key] ?? o.value;
    if (o.type === "number") {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < o.min ||
        v > o.max
      )
        throw new Error(`${o.label} must be between ${o.min} and ${o.max}.`);
    } else if (typeof v !== "string")
      throw new Error(`${o.label} must be text.`);
    if (o.type === "select" && !o.options.includes(v))
      throw new Error(`Choose a valid ${o.label}.`);
    result[o.key] = v;
  }
  return result;
}
export function searchTools(query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return tools
    .map((t) => ({
      t,
      score: terms.reduce(
        (s, w) =>
          s +
          (t.name.toLowerCase().includes(w) ? 3 : 0) +
          (t.description.toLowerCase().includes(w) ? 1 : 0) +
          (t.category.toLowerCase().includes(w) ? 1 : 0),
        0,
      ),
    }))
    .filter((x) => !terms.length || x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
