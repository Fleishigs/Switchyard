export const families = {
  image: {
    label: "Image",
    inputs:
      "jpg jpeg png webp avif tif tiff gif bmp ico tga svg ppm pgm pbm pnm",
    outputs: "png jpg webp avif tiff gif bmp ico tga",
    suggested: "png",
    note: "Still-image targets export one frame. GIF/WebP animation support depends on the source.",
  },
  audio: {
    label: "Audio",
    inputs:
      "wav mp3 flac m4a aac ogg opus aiff aif wma ac3 amr ape alac au mka",
    outputs: "wav mp3 flac m4a aac ogg opus aiff wma ac3",
    suggested: "mp3",
    note: "Lossy formats reduce quality. Converting to lossless cannot restore discarded detail.",
  },
  video: {
    label: "Video",
    inputs: "mp4 mov mkv avi webm wmv m4v mts m2ts mpeg mpg ts vob flv 3gp ogv",
    outputs: "mp4 mkv webm avi mov mpeg ts gif wav mp3 flac m4a opus",
    suggested: "mp4",
    note: "Audio targets extract the soundtrack. GIF export is limited to the first 30 seconds.",
  },
  document: {
    label: "Document",
    inputs:
      "txt md markdown rst html htm rtf doc docx odt ott fodt wps wpd tex latex epub fb2 ipynb org adoc asciidoc",
    outputs: "pdf docx odt rtf html txt md rst epub fb2 tex org",
    suggested: "pdf",
    note: "Complex layouts and unsupported fonts may change. Inspect the converted document.",
  },
  spreadsheet: {
    label: "Spreadsheet",
    inputs: "xlsx xls xlsm xlsb ods fods csv tsv xlt xltx",
    outputs: "xlsx ods csv tsv pdf html",
    suggested: "xlsx",
    note: "CSV/TSV contain the first sheet only and cannot preserve formulas, formatting, or multiple sheets.",
  },
  presentation: {
    label: "Presentation",
    inputs: "ppt pptx pptm odp otp",
    outputs: "pptx ppt odp pdf",
    suggested: "pdf",
    note: "Fonts, transitions, and embedded objects may render differently across formats.",
  },
  pdf: {
    label: "PDF",
    inputs: "pdf",
    outputs: "png jpg txt docx odt",
    suggested: "png",
    note: "Text extraction needs embedded text. PDF-to-document conversion preserves extracted text, not original layout.",
  },
  archive: {
    label: "Archive",
    inputs: "zip 7z tar rar gz bz2 xz cab iso zst tgz tbz2 txz",
    outputs: "zip 7z tar",
    suggested: "zip",
    note: "Encrypted archives and links are rejected. Expanded content is limited to 2 GB and 10,000 entries.",
  },
  font: {
    label: "Font",
    inputs: "ttf otf woff woff2",
    outputs: "woff woff2 sfnt",
    suggested: "woff2",
    note: "SFNT restores the original TTF or OTF outline format. It does not convert one outline type into another.",
  },
  mesh: {
    label: "3D mesh",
    inputs: "stl obj ply off glb gltf",
    outputs: "stl obj ply off glb",
    suggested: "glb",
    note: "Geometry conversion. Animation, rigging, and some materials are not preserved.",
  },
  subtitle: {
    label: "Subtitles",
    inputs: "srt vtt ass ssa",
    outputs: "srt vtt ass",
    suggested: "srt",
    note: "Simple subtitle targets cannot preserve every styling feature.",
  },
  database: {
    label: "SQLite database",
    inputs: "sqlite sqlite3 db",
    outputs: "json csv",
    suggested: "json",
    note: "Read-only export of ordinary tables. Limited to 100,000 rows per table; no database is modified.",
  },
  data: {
    label: "Structured data",
    inputs: "json yaml yml toml xml",
    outputs: "json yaml toml xml csv txt",
    suggested: "csv",
    note: "CSV needs an array of objects. TOML requires an object root. XML uses explicit attribute and text keys.",
  },
};
export function formatInfo(file) {
  const ext = file.split(/[\\/]/).pop().split(".").pop().toLowerCase();
  const entry = Object.entries(families).find(([, v]) =>
    v.inputs.split(" ").includes(ext),
  );
  if (!entry)
    return {
      extension: ext,
      family: null,
      label: "Unsupported",
      targets: [],
      suggested: null,
      note: "No reliable converter is included for this file type.",
    };
  const [family, v] = entry;
  return {
    extension: ext,
    family,
    label: v.label,
    targets: v.outputs.split(" "),
    suggested: v.suggested,
    note: v.note,
  };
}
export const supportedInputs = [
  ...new Set(Object.values(families).flatMap((f) => f.inputs.split(" "))),
];
