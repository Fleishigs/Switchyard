const image = /\.(png|jpe?g|webp|avif|tiff?|gif|svg)$/i;
const audio = /\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff?|wma|ac3)$/i;
const video = /\.(mp4|m4v|mov|mkv|webm|avi|mpeg|mpg|mts|m2ts|3gp|wmv)$/i;
export const fileKey = (p) => p.replaceAll("\\", "/").toLowerCase();
export const uniqueFiles = (files) => [
  ...new Map(files.map((f) => [fileKey(f.path), f])).values(),
];
export const combinesFiles = (tool) =>
  ["pdf-merge", "pdf-images", "image-contact"].includes(tool.id);
export function acceptsFile(tool, file) {
  if (tool.id === "pdf-images" || ["image", "ocr"].includes(tool.kind))
    return image.test(file.path);
  if (tool.kind === "pdf") return /\.pdf$/i.test(file.path);
  if (tool.kind === "video") return video.test(file.path);
  if (tool.kind === "audio" || tool.kind === "engine")
    return audio.test(file.path) || video.test(file.path);
  return false;
}
export function describeFile(file, jobs = []) {
  const job = jobs.find((j) =>
    j.outputs?.some((p) => fileKey(p) === fileKey(file.path)),
  );
  const parent = file.path.replaceAll("\\", "/").split("/").slice(-2, -1)[0];
  return `${file.name} — ${job ? "Result: " + job.name : parent}`;
}
