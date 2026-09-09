import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { formatInfo } from "../shared/formats.mjs";
import { processExtra } from "./extras.mjs";
import YAML from "yaml";
import TOML from "@iarna/toml";
import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
const pandocFormats = {
  md: "markdown",
  markdown: "markdown",
  txt: "plain",
  html: "html",
  htm: "html",
  tex: "latex",
  latex: "latex",
  adoc: "asciidoc",
  asciidoc: "asciidoc",
  docx: "docx",
  odt: "odt",
  epub: "epub",
  fb2: "fb2",
  rst: "rst",
  rtf: "rtf",
  ipynb: "ipynb",
  org: "org",
};
const officeOnly = new Set(["doc", "rtf", "ott", "fodt", "wps", "wpd"]);
export async function convertBatch(request, context, command) {
  const { files, options = {} } = request,
    { outputDir, engines = {}, signal, onLog } = context;
  const outputs = [],
    report = [];
  for (const [index, file] of files.entries()) {
    if (signal?.aborted) throw new Error("Cancelled");
    const info = formatInfo(file),
      target = options.targets?.[file] || info.suggested;
    try {
      if (!info.targets.includes(target))
        throw new Error("This conversion is not supported.");
      const folder = path.join(outputDir, String(index + 1).padStart(3, "0"));
      await fs.mkdir(folder, { recursive: true });
      const result = await convertOne(
        file,
        info,
        target,
        folder,
        context,
        command,
      );
      for (const p of result)
        if ((await fs.stat(p)).size === 0)
          throw new Error("The converter produced an empty file.");
      outputs.push(...result);
      report.push({ file, target, status: "done", outputs: result });
    } catch (e) {
      if (signal?.aborted) throw new Error("Cancelled");
      report.push({ file, target, status: "error", error: e.message });
    }
  }
  const reportPath = path.join(outputDir, "conversion-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  outputs.push(reportPath);
  return {
    outputs,
    text: report
      .map(
        (r) =>
          `${r.status.toUpperCase()} · ${path.basename(r.file)} → ${r.target || "unsupported"}${r.error ? "\n" + r.error : ""}`,
      )
      .join("\n\n"),
    failures: report.filter((r) => r.status === "error").length,
  };
}
async function convertOne(file, info, target, folder, context, command) {
  const { engines = {}, signal, onLog } = context,
    run = (exe, args, extra = {}) =>
      command(exe, args, { signal, onLog, ...extra }),
    out = path.join(folder, path.parse(file).name + "." + target);
  if (info.extension === target) {
    await fs.copyFile(file, out);
    return [out];
  }
  if (info.family === "image") {
    if (["png", "jpg", "webp", "avif", "tiff", "gif"].includes(target))
      try {
        await sharp(file, {
          animated: ["gif", "webp"].includes(target),
          limitInputPixels: 100e6,
        })
          .rotate()
          .toFormat(target === "jpg" ? "jpeg" : target,
            target === "tiff" ? { compression: "lzw" } : {})
          .toFile(out);
        return [out];
      } catch (e) {
        if (!engines.ffmpeg) throw e;
      }
    const args = ["-nostdin", "-v", "error", "-i", file, "-frames:v", "1"];
    if (target === "ico")
      args.push(
        "-vf",
        "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
      );
    args.push(out);
    await run(engines.ffmpeg || "ffmpeg", args);
    return [out];
  }
  if (info.family === "audio" || info.family === "video") {
    const audio = {
      wav: ["pcm_s16le"],
      mp3: ["libmp3lame", "-b:a", "192k"],
      flac: ["flac"],
      m4a: ["aac", "-b:a", "192k"],
      aac: ["aac", "-b:a", "192k"],
      ogg: ["libvorbis"],
      opus: ["libopus"],
      aiff: ["pcm_s16be"],
      wma: ["wmav2"],
      ac3: ["ac3"],
    };
    const args = ["-nostdin", "-v", "error", "-i", file];
    if (audio[target]) args.push("-vn", "-c:a", ...audio[target]);
    else if (target === "gif")
      args.push("-t", "30", "-vf", "fps=12,scale=480:-1", "-an");
    else if (target === "webm")
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
    else if (target === "avi")
      args.push("-c:v", "mpeg4", "-q:v", "5", "-c:a", "libmp3lame");
    else if (target === "mpeg")
      args.push("-c:v", "mpeg2video", "-c:a", "mp2", "-f", "mpeg");
    else
      args.push(
        "-vf",
        "pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
      );
    args.push(out);
    await run(engines.ffmpeg || "ffmpeg", args);
    return [out];
  }
  if (info.family === "pdf") {
    const rendered = await processExtra(
      {
        toolId:
          target === "png" || target === "jpg" ? "pdf-render" : "pdf-text",
        files: [file],
        text: "",
        options: { scale: 1.5 },
      },
      { ...context, outputDir: folder },
    );
    if (target === "png" || target === "txt") return rendered.outputs;
    if (target === "jpg") {
      const paths = [];
      for (const p of rendered.outputs) {
        const jpg = p.replace(/\.png$/, ".jpg");
        await sharp(p).jpeg({ quality: 90 }).toFile(jpg);
        await fs.rm(p);
        paths.push(jpg);
      }
      return paths;
    }
    if (!engines.pandoc) throw new Error("Pandoc is not available.");
    await run(engines.pandoc, [
      "--sandbox",
      "-f",
      "markdown",
      "-t",
      target,
      rendered.outputs[0],
      "-o",
      out,
    ]);
    return [out];
  }
  if (info.family === "archive") {
    if (!engines.sevenz) throw new Error("7-Zip is not available.");
    const listing = await run(engines.sevenz, ["l", "-slt", "-ba", "--", file]);
    const blocks = listing.split(/\r?\n\r?\n/).filter(Boolean);
    if (blocks.length > 10000) throw new Error("Archive has too many entries.");
    let total = 0;
    for (const block of blocks) {
      const name = block.match(/^Path = (.*)$/m)?.[1]?.trim();
      if (!name) continue;
      if (
        path.isAbsolute(name) ||
        /^[a-z]:/i.test(name) ||
        name.split(/[\\/]/).includes("..")
      )
        throw new Error("Archive contains unsafe paths.");
      if (
        /^(Symbolic Link|Hard Link) = /m.test(block) ||
        /^Encrypted = \+/m.test(block) ||
        /^Attributes = .*L/m.test(block)
      )
        throw new Error("Archives with links or encryption are not supported.");
      total += Number(block.match(/^Size = (\d+)/m)?.[1] || 0);
    }
    if (total > 2 * 1024 ** 3)
      throw new Error("Expanded archive exceeds 2 GB.");
    const extraction = path.join(folder, "contents");
    await fs.mkdir(extraction);
    await run(engines.sevenz, ["x", "-y", "-p", "-o" + extraction, "--", file]);
    await run(engines.sevenz, ["a", "-t" + target, out, "."], {
      cwd: extraction,
    });
    await fs.rm(extraction, { recursive: true, force: true });
    return [out];
  }
  if (info.family === "data") {
    if (target === "txt") {
      await fs.copyFile(file, out);
      return [out];
    }
    const raw = await fs.readFile(file, "utf8");
    if (raw.length > 20e6)
      throw new Error("Structured data is limited to 20 MB.");
    let value;
    if (info.extension === "json") value = JSON.parse(raw);
    else if (["yaml", "yml"].includes(info.extension))
      value = YAML.parse(raw, { maxAliasCount: 50 });
    else if (info.extension === "toml") value = TOML.parse(raw);
    else {
      const valid = XMLValidator.validate(raw);
      if (valid !== true) throw new Error("Invalid XML.");
      value = new XMLParser({
        ignoreAttributes: false,
        processEntities: false,
      }).parse(raw);
    }
    if (target !== "csv") {
      const serialized =
        target === "json"
          ? JSON.stringify(value, null, 2)
          : target === "yaml"
            ? YAML.stringify(value)
            : target === "toml"
              ? TOML.stringify(Array.isArray(value) ? { items: value } : value)
              : new XMLBuilder({ ignoreAttributes: false, format: true }).build(
                  { root: Array.isArray(value) ? { item: value } : value },
                );
      await fs.writeFile(out, serialized);
      return [out];
    }
    const result = await processExtra(
      {
        toolId: "text-json-csv",
        files: [],
        text: JSON.stringify(value),
        options: {},
      },
      { ...context, outputDir: folder },
    );
    await fs.rename(result.outputs[0], out);
    return [out];
  }
  if (info.family === "subtitle") {
    await run(engines.ffmpeg || "ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-i",
      file,
      out,
    ]);
    return [out];
  }
  if (info.family === "font" || info.family === "mesh") {
    const python = engines.separator;
    if (!python || path.basename(python).toLowerCase() !== "python.exe")
      throw new Error("Bundled Python conversion engine is unavailable.");
    const output = await run(python, [
      path.join(path.dirname(python), "../format-runner.py"),
      info.family,
      file,
      target,
      out,
    ]);
    const actual = output.trim().split(/\r?\n/).pop();
    if (!actual || path.dirname(path.resolve(actual)) !== path.resolve(folder))
      throw new Error("Invalid converter output path.");
    return [actual];
  }
  if (info.family === "database") {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(file, { readOnly: true });
    const paths = [];
    try {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .all();
      if (tables.length > 500) throw new Error("Database has too many tables.");
      for (const [index, { name }] of tables.entries()) {
        const quoted = '"' + name.replaceAll('"', '""') + '"';
        if (db.prepare("SELECT COUNT(*) AS n FROM " + quoted).get().n > 100000)
          throw new Error("Table exceeds 100,000 rows: " + name);
        const stmt = db.prepare("SELECT * FROM " + quoted);
        stmt.setReadBigInts(true);
        const rows = stmt
          .all()
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([k, v]) => [
                k,
                typeof v === "bigint"
                  ? v.toString()
                  : v instanceof Uint8Array
                    ? { base64: Buffer.from(v).toString("base64") }
                    : v,
              ]),
            ),
          );
        const p = path.join(
          folder,
          `${index + 1}-${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${target}`,
        );
        if (target === "json")
          await fs.writeFile(p, JSON.stringify(rows, null, 2));
        else {
          const result = await processExtra(
            {
              toolId: "text-json-csv",
              files: [],
              text: JSON.stringify(rows),
              options: {},
            },
            { ...context, outputDir: folder },
          );
          await fs.rename(result.outputs[0], p);
        }
        paths.push(p);
      }
      if (!paths.length)
        throw new Error("Database contains no ordinary tables.");
      return paths;
    } finally {
      db.close();
    }
  }
  const office = async (input, format) => {
    if (!engines.office) throw new Error("LibreOffice is not available.");
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'sy-office-'));
    try {
      const profile = path.join(scratch, 'profile');
      const staged = path.join(scratch, 'document' + path.extname(input));
      const converted = path.join(scratch, 'converted');
      await fs.copyFile(input, staged);
      await fs.mkdir(converted);
      await fs.mkdir(path.join(profile, 'user'), {recursive:true});
      await fs.writeFile(path.join(profile, 'user/registrymodifications.xcu'), '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>');
      const log = await run(engines.office, ['-env:UserInstallation=' + pathToFileURL(profile).href,'--headless','--nologo','--nodefault','--nofirststartwizard','--convert-to', format === 'tsv' ? 'csv:Text - txt - csv (StarCalc):9,34,76,1' : format,'--outdir',converted,staged], {timeout:180000});
      const produced = path.join(converted, 'document.' + (format === 'tsv' ? 'csv' : format));
      try { await fs.access(produced); } catch { throw new Error('LibreOffice did not create the requested file. ' + String(log).slice(-1500)); }
      const result = format === 'tsv' ? out : path.join(folder,path.parse(input).name+'.'+format);
      for (const entry of await fs.readdir(converted)) {
        const source = path.join(converted, entry);
        if (source === produced) await fs.copyFile(source, result);
        else await fs.cp(source, path.join(folder, entry), {recursive:true});
      }
      return result;
    } finally { await fs.rm(scratch, {recursive:true,force:true}); }

  };
  if (info.family === "spreadsheet" || info.family === "presentation")
    return [await office(file, target)];
  if (
    ["pdf", "docx", "odt", "rtf", "html", "txt"].includes(target) &&
    (!pandocFormats[info.extension] ||
      officeOnly.has(info.extension) ||
      ["docx", "odt"].includes(info.extension))
  )
    return [await office(file, target)];
  if (!engines.pandoc) throw new Error("Pandoc is not available.");
  let input = file,
    from = pandocFormats[info.extension] || "docx";
  if (officeOnly.has(info.extension)) {
    input = await office(file, "docx");
    from = "docx";
  }
  if (from === "plain") from = "markdown";
  if (target === "pdf") {
    const intermediate = path.join(folder, "source.docx");
    await run(engines.pandoc, [
      "--sandbox",
      "-f",
      from,
      "-t",
      "docx",
      input,
      "-o",
      intermediate,
    ]);
    return [await office(intermediate, "pdf")];
  }
  await run(engines.pandoc, [
    "--sandbox",
    "-s",
    "-f",
    from,
    "-t",
    pandocFormats[target] || target,
    input,
    "-o",
    out,
  ]);
  return [out];
}
