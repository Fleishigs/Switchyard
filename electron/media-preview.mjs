import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

// Only opaque tokens issued for explicitly selected files can be streamed.
export function createMediaPreview({ protocol, allowed, engines }) {
  const tokens = new Map(),
    cache = new Map(),
    children = new Set(),
    waves = new Map(),
    strips = new Map();
  let waveQueue = Promise.resolve(),
    disposed = false;
  function run(exe, args, onChunk) {
    return new Promise((resolve, reject) => {
      if (disposed) {
        reject(new Error("Preview closed"));
        return;
      }
      const child = spawn(exe, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.add(child);
      let output = "",
        error = "";
      const timer = setTimeout(() => child.kill(), 120000);
      child.stdout.on("data", (b) => {
        if (onChunk) onChunk(b);
        else output += b.toString();
      });
      child.stderr.on("data", (b) => {
        error = (error + b.toString()).slice(-2000);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        children.delete(child);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        children.delete(child);
        code === 0
          ? resolve(output)
          : reject(
              new Error(
                "Could not prepare media preview. " + error.slice(-300),
              ),
            );
      });
    });
  }
  const mime = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
  };
  protocol.handle("sy-media", async (request) => {
    const entry = tokens.get(new URL(request.url).hostname);
    if (!entry || !allowed.has(entry.file))
      return new Response("Unknown media", { status: 404 });
    try {
      const stat = await fsp.stat(entry.file),
        size = stat.size;
      if (stat.mtimeMs !== entry.mtime || size !== entry.size)
        return new Response("File changed. Reopen the preview.", {
          status: 409,
        });
      let start = 0,
        end = size - 1,
        status = 200;
      const range = request.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        if (!match[1]) start = Math.max(0, size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= size
        )
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        status = 206;
      }
      const headers = {
        "Content-Type":
          mime[path.extname(entry.file).toLowerCase()] ||
          "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "no-store",
      };
      if (status === 206)
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      return new Response(
        request.method === "HEAD"
          ? null
          : Readable.toWeb(fs.createReadStream(entry.file, { start, end })),
        { status, headers },
      );
    } catch {
      return new Response("Media is no longer available", { status: 404 });
    }
  });
  return {
    async preview(file) {
      if (typeof file !== "string" || !allowed.has(file))
        throw new Error("Choose this file first.");
      const stat = await fsp.stat(file),
        key = file + "|" + stat.mtimeMs + "|" + stat.size;
      if (cache.has(key)) return cache.get(key);
      const pending = (async () => {
        const info = JSON.parse(
          await run(engines.ffprobe || "ffprobe", [
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            file,
          ]),
        );
        const video = info.streams.find(
            (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
          ),
          audio = info.streams.find((s) => s.codec_type === "audio");
        const duration =
          Number(info.format?.duration) ||
          Math.max(...info.streams.map((s) => Number(s.duration) || 0));
        if (!Number.isFinite(duration) || !(duration > 0) || (!video && !audio))
          throw new Error("This file has no playable audio or video.");
        const token = crypto.randomUUID();
        tokens.set(token, { file, mtime: stat.mtimeMs, size: stat.size });
        return {
          url: `sy-media://${token}/stream`,
          duration,
          video: !!video,
          audio: !!audio,
          width: video?.width,
          height: video?.height,
          peaks: [],
          fps: video
            ? (() => {
                const [a, b] = String(video.avg_frame_rate || "0/1")
                  .split("/")
                  .map(Number);
                return a / b || 30;
              })()
            : 0,
          sampleRate: Number(audio?.sample_rate) || 48000,
          name: path.basename(file),
        };
      })();
      cache.set(key, pending);
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      try {
        return await pending;
      } catch (error) {
        cache.delete(key);
        throw error;
      }
    },
    async waveform(file) {
      const info = await this.preview(file);
      if (!info.audio) return [];
      const key = info.url;
      if (waves.has(key)) return waves.get(key);
      const task = waveQueue
        .catch(() => {})
        .then(async () => {
          const peaks = new Float32Array(2400);
          let carry = Buffer.alloc(0),
            sample = 0;
          const count = Math.ceil(info.duration * 48000);
          await run(
            engines.ffmpeg || "ffmpeg",
            [
              "-nostdin",
              "-v",
              "error",
              "-i",
              file,
              "-map",
              "0:a:0",
              "-vn",
              "-ac",
              "1",
              "-ar",
              "48000",
              "-f",
              "f32le",
              "pipe:1",
            ],
            (chunk) => {
              const bytes = Buffer.concat([carry, chunk]),
                length = bytes.length - (bytes.length % 4);
              for (let i = 0; i < length; i += 4) {
                const bin = Math.min(
                    2399,
                    Math.floor((sample++ * 2400) / count),
                  ),
                  value = Math.abs(bytes.readFloatLE(i));
                if (Number.isFinite(value))
                  peaks[bin] = Math.max(peaks[bin], value);
              }
              carry = bytes.subarray(length);
            },
          );
          return Array.from(peaks);
        });
      waveQueue = task;
      waves.set(key, task);
      if (waves.size > 40) waves.delete(waves.keys().next().value);
      try {
        return await task;
      } catch (e) {
        waves.delete(key);
        throw e;
      }
    },
    async thumbnails(file) {
      const info = await this.preview(file);
      if (!info.video) return null;
      if (strips.has(info.url)) return strips.get(info.url);
      const task = (async () => {
        const chunks = [];
        await run(
          engines.ffmpeg || "ffmpeg",
          [
            "-nostdin",
            "-v",
            "error",
            "-i",
            file,
            "-an",
            "-vf",
            `fps=${8 / info.duration},scale=144:-2,tile=8x1`,
            "-frames:v",
            "1",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
          ],
          (chunk) => chunks.push(chunk),
        );
        return (
          "data:image/png;base64," + Buffer.concat(chunks).toString("base64")
        );
      })();
      strips.set(info.url, task);
      if (strips.size > 30) strips.delete(strips.keys().next().value);
      try {
        return await task;
      } catch (e) {
        strips.delete(info.url);
        throw e;
      }
    },
    dispose() {
      disposed = true;
      for (const child of children) child.kill();
      tokens.clear();
      cache.clear();
      waves.clear();
      strips.clear();
    },
  };
}
