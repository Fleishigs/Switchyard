import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const models = {
  "Upscayl Lite": "upscayl-lite-4x",
  "Upscayl Standard": "upscayl-standard-4x",
  "Digital Art": "digital-art-4x",
};
export async function upscale(files, options, context, command) {
  const { outputDir, signal, onLog = () => {}, engines = {} } = context;
  const executable = engines.upscayl;
  if (!executable)
    throw new Error(
      "Upscayl is not installed. Install the full Switchyard build to use local AI enhancement.",
    );
  const model = models[options.model],
    scale = Number(options.scale),
    format = options.format.toLowerCase(),
    outputs = [];
  const temporary = await fs.mkdtemp(path.join(outputDir, ".upscale-"));
  try {
    for (const [index, file] of files.entries()) {
      if (signal?.aborted) throw new Error("Cancelled");
      const input = path.join(temporary, "input.png"),
        generated = path.join(temporary, "result.png");
      const normalized = await sharp(file, { limitInputPixels: 100_000_000 })
        .rotate()
        .png()
        .toBuffer({ resolveWithObject: true });
      const { width, height, channels } = normalized.info;
      if (width * height * scale * scale > 100_000_000)
        throw new Error(
          "This scale exceeds 100 million output pixels. Choose 2× or resize the input first.",
        );
      await sharp(normalized.data).removeAlpha().png().toFile(input);
      onLog(
        `Upscayl ${options.model}: ${width} × ${height} → ${width * scale} × ${height * scale}\n`,
      );
      await command(
        executable,
        [
          "-i",
          input,
          "-o",
          generated,
          "-m",
          path.join(path.dirname(executable), "models"),
          "-n",
          model,
          "-z",
          "4",
          "-s",
          String(scale),
          "-t",
          "128",
          "-j",
          "1:1:1",
          "-f",
          "png",
        ],
        { signal, onLog, timeout: 30 * 60 * 1000 },
      );
      if (signal?.aborted) throw new Error("Cancelled");
      const meta = await sharp(generated).metadata();
      if (meta.width !== width * scale || meta.height !== height * scale)
        throw new Error("The AI engine returned unexpected output dimensions.");
      const rgb = await sharp(generated).removeAlpha().png().toBuffer();
      let result = sharp(rgb);
      if (channels === 4) {
        const alpha = await sharp(normalized.data)
          .extractChannel("alpha")
          .resize(width * scale, height * scale)
          .raw()
          .toBuffer();
        result = result.joinChannel(alpha, {
          raw: { width: width * scale, height: height * scale, channels: 1 },
        });
      }
      const name = `${index + 1}-${path.parse(file).name}-ai-${scale}x.${format === "jpeg" ? "jpg" : format}`,
        destination = path.join(outputDir, name);
      if (format === "jpeg")
        result = result
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 95 });
      else if (format === "webp") result = result.webp({ quality: 95 });
      else result = result.png();
      await result.toFile(destination);
      outputs.push(destination);
      await fs.rm(generated, { force: true });
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
  return { outputs };
}
