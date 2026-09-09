import { upscale } from "./upscaler.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { PDFDocument, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { toolById, validateOptions } from "../shared/catalog.mjs";
import { extraIds, processExtra } from "./extras.mjs";
import { convertBatch } from "./converter.mjs";

export function command(
  executable,
  args,
  {
    signal,
    onLog = () => {},
    timeout = 30 * 60 * 1000,
    env = process.env,
    cwd,
  } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Cancelled"));
    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      cwd,
    });
    let stdout = "",
      stderr = "",
      settled = false;
    let timedOut = false;
    const stop = () => {
      if (process.platform === "win32" && child.pid) {
        const killer = spawn(
          "taskkill.exe",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => child.kill());
      } else child.kill();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeout);
    signal?.addEventListener("abort", stop, { once: true });
    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      err ? reject(err) : resolve(stdout);
    }
    child.stdout.on("data", (b) => {
      stdout = (stdout + b).slice(-2_000_000);
      onLog(b.toString());
    });
    child.stderr.on("data", (b) => {
      stderr = (stderr + b).slice(-20000);
      onLog(b.toString());
    });
    child.on("error", (e) =>
      finish(
        new Error(`Cannot start ${path.basename(executable)}: ${e.message}`),
      ),
    );
    child.on("close", (code) =>
      finish(
        timedOut
          ? new Error("Processing exceeded the time limit.")
          : signal?.aborted
            ? new Error("Cancelled")
            : code !== 0
              ? new Error(
                  stderr.slice(-3000) || `Process ended with code ${code}`,
                )
              : null,
      ),
    );
  });
}
function textOperation(id, t, o) {
  switch (id) {
    case "text-stats":
      return JSON.stringify(
        {
          characters: [...t].length,
          words: t.trim() ? t.trim().split(/\s+/).length : 0,
          lines: t ? t.split(/\r?\n/).length : 0,
          readingMinutes: Math.ceil((t.match(/\S+/g) || []).length / 200),
        },
        null,
        2,
      );
    case "text-upper":
      return t.toUpperCase();
    case "text-lower":
      return t.toLowerCase();
    case "text-title":
      return t.replace(/\p{L}[\p{L}\p{M}\p{N}'’]*/gu, (word) =>
        word.replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
      );
    case "text-slug":
      return t
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");
    case "text-sort":
      return t
        .split(/\r?\n/)
        .sort((a, b) => a.localeCompare(b))
        .join("\n");
    case "text-unique":
      return [...new Set(t.split(/\r?\n/))].join("\n");
    case "text-trim":
      return t
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n");
    case "text-json":
      return JSON.stringify(JSON.parse(t), null, 2);
    case "text-json-min":
      return JSON.stringify(JSON.parse(t));
    case "text-base64":
      return Buffer.from(t).toString("base64");
    case "text-unbase64":
      if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          t.trim(),
        )
      )
        throw new Error("Enter valid padded Base64.");
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.from(t.trim(), "base64"),
      );
    case "text-url":
      return encodeURIComponent(t);
    case "text-unurl":
      return decodeURIComponent(t);
    case "text-sha256":
      return crypto.createHash("sha256").update(t).digest("hex");
    case "text-uuid":
      return Array.from({ length: o.count }, () => crypto.randomUUID()).join(
        "\n",
      );
    case "text-password": {
      const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=?";
      return Array.from(
        { length: o.length },
        () => chars[crypto.randomInt(chars.length)],
      ).join("");
    }
    default:
      throw new Error("Unknown text operation");
  }
}
export async function processTool(
  { toolId, files = [], text = "", options = {} },
  context,
) {
  const tool = toolById[toolId];
  if (!tool) throw new Error("Unknown tool");
  const o = validateOptions(tool, options),
    { outputDir, signal, onLog, engines = {} } = context;
  const check = () => {
    if (signal?.aborted) throw new Error("Cancelled");
  };
  check();
  if (typeof text !== "string" || text.length > 5_000_000)
    throw new Error("Text is limited to 5 million characters.");
  if (!["text", "download"].includes(tool.kind) && !files.length)
    throw new Error("Add at least one input file.");
  if (files.length > 100) throw new Error("Use at most 100 files per job.");
  await fs.mkdir(outputDir, { recursive: true });
  if (toolId === "image-upscale") return upscale(files, o, context, command);
  if (toolId === "batch-convert")
    return convertBatch({ files, options }, context, command);
  if (extraIds.has(toolId))
    return processExtra({ toolId, files, text, options: o }, context);
  const outputs = [];
  let resultText;
  const out = (name) => path.join(outputDir, name);
  const saveText = async (value, name = "result.txt") => {
    resultText = value;
    const p = out(name);
    await fs.writeFile(p, value);
    outputs.push(p);
  };
  if (tool.kind === "text") {
    if (toolId === "text-qr") {
      const p = out("qr-code.png");
      await QRCode.toFile(p, text, { width: 1024, margin: 2 });
      outputs.push(p);
    } else await saveText(textOperation(toolId, text, o));
  } else if (tool.kind === "image") {
    for (const [i, file] of files.entries()) {
      check();
      let s = sharp(file, { limitInputPixels: 100_000_000 }).rotate();
      const metadata = await s.metadata();
      if (toolId === "image-metadata") {
        await saveText(
          JSON.stringify(
            metadata,
            (k, v) => (Buffer.isBuffer(v) ? `[${v.length} bytes]` : v),
            2,
          ),
          `${i + 1}-metadata.json`,
        );
        continue;
      }
      switch (toolId) {
        case "image-enhance":
          s = s.normalise({ lower: 1, upper: 99 }).sharpen({
            sigma: 0.8,
            m1: 0,
            m2: 1.5,
            x1: 3,
            y2: 8,
            y3: 8,
          });
          break;
        case "image-resize":
          s = s.resize({
            width: Math.round(o.width),
            height: Math.round(o.height),
            fit: "inside",
          });
          break;
        case "image-crop":
          s = s.extract({
            left: Math.round(o.left),
            top: Math.round(o.top),
            width: Math.round(o.width),
            height: Math.round(o.height),
          });
          break;
        case "image-rotate":
          s = s.rotate(o.angle, { background: "#00000000" });
          break;
        case "image-flip":
          s = s.flip();
          break;
        case "image-mirror":
          s = s.flop();
          break;
        case "image-grayscale":
          s = s.grayscale();
          break;
        case "image-blur":
          s = s.blur(o.sigma);
          break;
        case "image-sharpen":
          s = s.sharpen({ sigma: o.sigma });
          break;
        case "image-brightness":
          s = s.modulate({ brightness: o.amount });
          break;
        case "image-saturation":
          s = s.modulate({ saturation: o.amount });
          break;
        case "image-negative":
          s = s.negate();
          break;
        case "image-trim":
          s = s.trim();
          break;
        case "image-thumbnail":
          s = s.resize(Math.round(o.width), Math.round(o.width), {
            fit: "cover",
          });
          break;
        case "image-border":
          s = s.extend({
            top: Math.round(o.width),
            bottom: Math.round(o.width),
            left: Math.round(o.width),
            right: Math.round(o.width),
            background: o.color,
          });
          break;
      }
      let ext = "png";
      if (["image-jpeg", "image-webp", "image-avif"].includes(toolId))
        ext = toolId.slice(6);
      const p = out(`${i + 1}-${path.parse(file).name}.${ext}`);
      // PNG's `quality` option enables palette quantization, even for crop/flip.
      // Keep edits lossless; apply quality only to explicitly lossy export tools.
      await s
        .toFormat(
          ext,
          ext === "png"
            ? { compressionLevel: 3 }
            : { quality: Math.round(o.quality ?? 85) },
        )
        .toFile(p);
      outputs.push(p);
    }
  } else if (tool.kind === "pdf") {
    const doc = await PDFDocument.create();
    if (toolId === "pdf-images") {
      for (const file of files) {
        check();
        const bytes = await sharp(file).rotate().png().toBuffer();
        const img = await doc.embedPng(bytes);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });
      }
    } else {
      for (const file of files) {
        check();
        const source = await PDFDocument.load(await fs.readFile(file));
        let indices = source.getPageIndices();
        if (toolId === "pdf-metadata") {
          await saveText(
            JSON.stringify(
              {
                file: path.basename(file),
                pages: source.getPageCount(),
                title: source.getTitle(),
                author: source.getAuthor(),
                subject: source.getSubject(),
              },
              null,
              2,
            ),
            `${outputs.length + 1}-metadata.json`,
          );
          continue;
        }
        if (toolId === "pdf-extract") {
          if (o.start > o.end || o.end > indices.length)
            throw new Error(
              `Page range must fit this document (${indices.length} pages).`,
            );
          indices = indices.slice(o.start - 1, o.end);
        }
        if (toolId === "pdf-reverse") indices.reverse();
        const pages = await doc.copyPages(source, indices);
        for (const page of pages) {
          if (toolId === "pdf-rotate")
            page.setRotation(degrees((page.getRotation().angle + 90) % 360));
          doc.addPage(page);
        }
      }
    }
    if (toolId !== "pdf-metadata") {
      const p = out("document.pdf");
      await fs.writeFile(p, await doc.save());
      outputs.push(p);
    }
  } else if (tool.kind === "download") {
    let url;
    try {
      url = new URL(o.url);
    } catch {
      throw new Error("Enter a valid HTTPS video URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Use an HTTPS URL without credentials.");
    const args = [
      "--ignore-config",
      "--compat-options",
      "no-certifi",
      "--no-playlist",
      "--no-overwrites",
      "--restrict-filenames",
      "--newline",
      "--paths",
      outputDir,
      "-o",
      "%(title).120B [%(id)s].%(ext)s",
    ];
    if (engines.ffmpeg) args.push("--ffmpeg-location", engines.ffmpeg);
    if (toolId === "download-audio") args.push("-x", "--audio-format", "mp3");
    else args.push("--merge-output-format", "mp4");
    args.push("--", url.href);
    await command(engines.ytdlp || "yt-dlp", args, { signal, onLog });
    for (const name of await fs.readdir(outputDir))
      if (!name.endsWith(".part")) outputs.push(out(name));
  } else if (tool.kind === "engine") {
    if (toolId === "voice-vocals") {
      if (!engines.separator)
        throw new Error(
          "Vocal separation engine is not configured. Open Engines to see setup instructions.",
        );
      for (const [index, file] of files.entries()) {
        check();
        const stemDir = out(`stems-${index + 1}`);
        await fs.mkdir(stemDir, { recursive: true });
        const embedded =
          path.basename(engines.separator).toLowerCase() === "python.exe";
        const prefix = embedded
          ? [
              path.join(
                path.dirname(engines.separator),
                "../separator-runner.py",
              ),
            ]
          : [];
        await command(
          engines.separator,
          [
            ...prefix,
            file,
            "--model_filename",
            engines.separatorModel || "UVR-MDX-NET-Inst_HQ_3.onnx",
            "--output_dir",
            stemDir,
            ...(engines.separatorModels
              ? ["--model_file_dir", engines.separatorModels]
              : []),
            "--output_format",
            "WAV",
          ],
          {
            signal,
            onLog,
            env: {
              ...process.env,
              PATH:
                (engines.ffmpeg
                  ? path.dirname(engines.ffmpeg) + path.delimiter
                  : "") + (process.env.PATH || ""),
            },
          },
        );
        for (const name of await fs.readdir(stemDir))
          outputs.push(path.join(stemDir, name));
      }
    } else {
      if (!engines.whisper || !engines.whisperModel)
        throw new Error(
          "Local Whisper engine and model are not configured. Open Engines to set their paths.",
        );
      for (const [i, file] of files.entries()) {
        const wav = out(`input-${i}.wav`);
        await command(
          engines.ffmpeg || "ffmpeg",
          [
            "-nostdin",
            "-v",
            "error",
            "-i",
            file,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            wav,
          ],
          { signal, onLog },
        );
        const prefix = out(`transcript-${i + 1}`);
        await command(
          engines.whisper,
          [
            "-m",
            engines.whisperModel,
            "-f",
            wav,
            "-otxt",
            "-osrt",
            "-of",
            prefix,
            "-nt",
          ],
          { signal, onLog },
        );
        await fs.rm(wav, { force: true });
        outputs.push(prefix + ".txt", prefix + ".srt");
        resultText = await fs.readFile(prefix + ".txt", "utf8");
      }
    }
  } else {
    for (const [i, file] of files.entries()) {
      check();
      const ffmpeg = engines.ffmpeg || "ffmpeg";
      if (toolId === "audio-inspect") {
        const report = await command(
          engines.ffprobe || "ffprobe",
          ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
          { signal, onLog },
        );
        await saveText(report, `${i + 1}-media.json`);
        continue;
      }
      const args = [
        "-nostdin",
        "-hide_banner",
        "-v",
        "warning",
        "-n",
        "-i",
        file,
      ];
      let ext = tool.kind === "audio" ? "wav" : "mp4";
      const filters = [];
      if (tool.kind === "audio") args.push("-vn");
      switch (toolId) {
        case "audio-mp3":
          ext = "mp3";
          args.push("-c:a", "libmp3lame", "-b:a", "192k");
          break;
        case "audio-flac":
          ext = "flac";
          args.push("-c:a", "flac");
          break;
        case "audio-aac":
          ext = "m4a";
          args.push("-c:a", "aac", "-b:a", "192k");
          break;
        case "audio-opus":
          ext = "opus";
          args.push("-c:a", "libopus", "-b:a", "128k");
          break;
        case "audio-wav":
          args.push("-ar", "48000");
          break;
        case "audio-trim":
        case "video-trim":
          args.push("-ss", String(o.start), "-t", String(o.duration));
          break;
        case "audio-normalize":
          {
            let analysis = "";
            await command(
              ffmpeg,
              [
                "-nostdin",
                "-hide_banner",
                "-i",
                file,
                "-vn",
                "-af",
                "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
                "-f",
                "null",
                "-",
              ],
              {
                signal,
                onLog: (line) => {
                  analysis += line;
                  onLog?.(line);
                },
              },
            );
            const match = analysis.match(/\{\s*"input_i"[\s\S]*?\}/);
            if (!match) throw new Error("Could not measure input loudness.");
            const measured = JSON.parse(match[0]);
            const fields = [
              "input_i",
              "input_tp",
              "input_lra",
              "input_thresh",
              "target_offset",
            ];
            filters.push(
              fields.every((key) => Number.isFinite(Number(measured[key])))
                ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
                : "anull",
            );
          }
          break;
        case "audio-volume":
          filters.push(`volume=${o.gain}dB`);
          break;
        case "audio-fade-in":
          filters.push(`afade=t=in:d=${o.duration}`);
          break;
        case "audio-fade-out":
          filters.push(`areverse,afade=t=in:d=${o.duration},areverse`);
          break;
        case "audio-reverse":
          filters.push("areverse");
          break;
        case "audio-speed":
          filters.push(`atempo=${o.speed}`);
          break;
        case "audio-mono":
          args.push("-ac", "1");
          break;
        case "audio-denoise":
          filters.push("afftdn=nf=-25");
          break;
        case "audio-highpass":
          filters.push(`highpass=f=${o.frequency}`);
          break;
        case "audio-lowpass":
          filters.push(`lowpass=f=${o.frequency}`);
          break;
        case "audio-silence":
          filters.push(
            "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-45dB",
          );
          break;
        case "video-webm":
          ext = "webm";
          args.push(
            "-c:v",
            "libvpx-vp9",
            "-crf",
            "32",
            "-b:v",
            "0",
            "-c:a",
            "libopus",
          );
          break;
        case "video-mute":
          args.push("-an", "-c:v", "copy");
          break;
        case "video-extract":
          ext = "wav";
          args.push("-vn", "-c:a", "pcm_s16le");
          break;
        case "video-resize":
          args.push("-vf", `scale=${Math.round(o.width / 2) * 2}:-2`);
          break;
        case "video-compress":
          args.push("-crf", String(o.crf));
          break;
        case "video-gif":
          if (o.duration > 30)
            throw new Error(
              "GIF selections are limited to 30 seconds. Shorten the selected interval.",
            );
          ext = "gif";
          args.push(
            "-ss",
            String(o.start),
            "-t",
            String(o.duration),
            "-vf",
            "fps=12,scale=480:-1:flags=lanczos",
            "-an",
          );
          break;
        case "video-frame":
          ext = "png";
          args.push(
            "-ss",
            String(o.start),
            "-frames:v",
            "1",
            "-update",
            "1",
            "-an",
          );
          break;
        case "video-rotate":
          args.push("-vf", "transpose=1");
          break;
        case "video-mirror":
          args.push("-vf", "hflip");
          break;
        case "video-speed":
          args.push("-vf", `setpts=PTS/${o.speed}`, "-af", `atempo=${o.speed}`);
          break;
      }
      if (filters.length) args.push("-af", filters.join(","));
      if (ext === "wav") args.push("-c:a", "pcm_s16le");
      if (ext === "mp4" && toolId !== "video-mute")
        args.push(
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
        );
      const p = out(`${i + 1}-${path.parse(file).name}.${ext}`);
      args.push(p);
      await command(ffmpeg, args, { signal, onLog });
      outputs.push(p);
    }
  }
  check();
  if (!outputs.length)
    throw new Error("The engine did not produce any output files.");
  return { outputs, text: resultText };
}
