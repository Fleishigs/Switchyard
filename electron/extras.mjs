import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { diffLines } from "diff";
const require = createRequire(import.meta.url);
export const extraIds = new Set([
  "image-pixelate",
  "image-tint",
  "image-threshold",
  "image-rounded",
  "image-contact",
  "image-watermark",
  "image-palette",
  "pdf-split",
  "pdf-delete",
  "pdf-number",
  "pdf-watermark",
  "pdf-text",
  "pdf-render",
  "pdf-edit-info",
  "text-csv-json",
  "text-json-csv",
  "text-html-escape",
  "text-html-unescape",
  "text-number-lines",
  "text-replace",
  "text-diff",
  "text-jwt",
  "text-pdf",
  "unit-length",
  "unit-mass",
  "unit-temperature",
  "unit-storage",
  "date-distance",
  "number-base",
  "color-inspect",
  "image-ocr",
]);
const escape = (t) =>
  t.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function parseCsv(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (!quoted && value.length)
        throw new Error("Unexpected quote in CSV field.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV headers must be unique.");
  return rows.map((r) => {
    if (r.length !== headers.length)
      throw new Error("CSV rows must have the same number of columns.");
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
function textExtra(id, text, o) {
  if (id === "text-csv-json") return JSON.stringify(parseCsv(text), null, 2);
  if (id === "text-json-csv") {
    const rows = JSON.parse(text);
    if (
      !Array.isArray(rows) ||
      rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))
    )
      throw new Error("Enter a JSON array of objects.");
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    return [
      keys,
      ...rows.map((r) =>
        keys.map((k) =>
          typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k],
        ),
      ),
    ]
      .map((r) => r.map(quote).join(","))
      .join("\r\n");
  }
  if (id === "text-html-escape") return escape(text);
  if (id === "text-html-unescape")
    return text.replace(
      /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (_, v) =>
        v[0] === "#"
          ? String.fromCodePoint(
              v[1].toLowerCase() === "x"
                ? parseInt(v.slice(2), 16)
                : parseInt(v.slice(1), 10),
            )
          : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[
              v.toLowerCase()
            ],
    );
  if (id === "text-number-lines")
    return text
      .split(/\r?\n/)
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");
  if (id === "text-replace") {
    if (!o.find) throw new Error("Enter text to find.");
    return text.split(o.find).join(o.replacement);
  }
  if (id === "text-diff") {
    const parts = diffLines(text, o.other, {
      timeout: 2000,
      maxEditLength: 10000,
    });
    if (!parts)
      throw new Error("These texts are too different or large to compare.");
    return parts
      .map((p) =>
        p.value
          .split("\n")
          .map((l) => (p.added ? "+ " : p.removed ? "- " : "  ") + l)
          .join("\n"),
      )
      .join("\n");
  }
  if (id === "text-jwt") {
    const parts = text.trim().split(".");
    if (parts.length !== 3)
      throw new Error("A JWT must contain three dot-separated sections.");
    return JSON.stringify(
      {
        warning: "Decoded only. Signature NOT verified.",
        header: JSON.parse(Buffer.from(parts[0], "base64url").toString()),
        claims: JSON.parse(Buffer.from(parts[1], "base64url").toString()),
      },
      null,
      2,
    );
  }
  const factors =
    id === "unit-length"
      ? {
          meters: 1,
          kilometers: 1000,
          feet: 0.3048,
          inches: 0.0254,
          miles: 1609.344,
        }
      : id === "unit-mass"
        ? {
            kilograms: 1,
            grams: 0.001,
            pounds: 0.45359237,
            ounces: 0.028349523125,
          }
        : id === "unit-storage"
          ? {
              bytes: 1,
              KB: 1000,
              MB: 1e6,
              GB: 1e9,
              KiB: 1024,
              MiB: 1048576,
              GiB: 1073741824,
            }
          : null;
  if (factors)
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(factors).map(([k, v]) => [
          k,
          (o.value * factors[o.unit]) / v,
        ]),
      ),
      null,
      2,
    );
  if (id === "unit-temperature") {
    const c =
      o.unit === "Celsius"
        ? o.value
        : o.unit === "Fahrenheit"
          ? ((o.value - 32) * 5) / 9
          : o.value - 273.15;
    if (c < -273.15) throw new Error("Temperature is below absolute zero.");
    return JSON.stringify(
      { Celsius: c, Fahrenheit: (c * 9) / 5 + 32, Kelvin: c + 273.15 },
      null,
      2,
    );
  }
  if (id === "date-distance") {
    const parse = (s) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        throw new Error("Use YYYY-MM-DD dates.");
      const date = new Date(s + "T00:00:00Z");
      if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== s)
        throw new Error("Invalid calendar date.");
      return date;
    };
    const days = (parse(o.to) - parse(o.from)) / 86400000;
    return JSON.stringify({ days, weeks: days / 7, hours: days * 24 }, null, 2);
  }
  if (id === "number-base") {
    const patterns = { 2: /^-?[01]+$/, 10: /^-?\d+$/, 16: /^-?[0-9a-f]+$/i };
    if (!patterns[o.base].test(o.value))
      throw new Error("Invalid digits for the selected base.");
    const negative = o.value.startsWith("-"),
      digits = negative ? o.value.slice(1) : o.value,
      n =
        BigInt((o.base === "2" ? "0b" : o.base === "16" ? "0x" : "") + digits) *
        (negative ? -1n : 1n);
    return JSON.stringify(
      {
        binary: n.toString(2),
        decimal: n.toString(10),
        hexadecimal: n.toString(16).toUpperCase(),
      },
      null,
      2,
    );
  }
  if (id === "color-inspect") {
    if (!/^#[0-9a-f]{6}$/i.test(o.color))
      throw new Error("Use a six-digit hex color such as #356347.");
    const channels = [1, 3, 5].map((i) =>
        parseInt(o.color.slice(i, i + 2), 16),
      ),
      [r, g, b] = channels.map((x) => x / 255),
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      delta = max - min,
      l = (max + min) / 2;
    let h =
      delta === 0
        ? 0
        : max === r
          ? ((g - b) / delta) % 6
          : max === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
    const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1)),
      linear = channels.map((v) =>
        v / 255 <= 0.04045
          ? v / 255 / 12.92
          : ((v / 255 + 0.055) / 1.055) ** 2.4,
      ),
      lum = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return JSON.stringify(
      {
        hex: o.color.toUpperCase(),
        rgb: channels,
        hsl: [h, sat * 100, l * 100],
        contrastWithWhite: 1.05 / (lum + 0.05),
        contrastWithBlack: (lum + 0.05) / 0.05,
      },
      null,
      2,
    );
  }
  throw new Error("Unknown extra operation");
}
export async function processExtra(
  { toolId: id, files, text, options: o },
  { outputDir, engines = {}, signal },
) {
  const outputs = [];
  let resultText;
  const check = () => {
    if (signal?.aborted) throw new Error("Cancelled");
  };
  const write = async (name, value) => {
    const p = path.join(outputDir, name);
    await fs.writeFile(p, value);
    outputs.push(p);
  };
  check();
  if (id === "image-ocr") {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      langPath: engines.ocrModels,
      cachePath: path.join(outputDir, "ocr-cache"),
      logger: () => {},
    });
    const abort = () => void worker.terminate();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      for (const [i, file] of files.entries()) {
        check();
        const { data } = await worker.recognize(file);
        resultText = data.text;
        await write(`${i + 1}-recognized.txt`, data.text);
      }
    } finally {
      signal?.removeEventListener("abort", abort);
      await worker.terminate().catch(() => {});
    }
  } else if (id === "pdf-text" || id === "pdf-render") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    for (const [i, file] of files.entries()) {
      check();
      const task = pdfjs.getDocument({
        data: new Uint8Array(await fs.readFile(file)),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      const doc = await task.promise;
      try {
        if (doc.numPages > 300)
          throw new Error("Use at most 300 PDF pages per batch.");
        let all = "";
        for (let n = 1; n <= doc.numPages; n++) {
          check();
          const page = await doc.getPage(n);
          if (id === "pdf-text") {
            const content = await page.getTextContent();
            all +=
              content.items
                .map((x) => x.str + (x.hasEOL ? "\n" : " "))
                .join("") + "\n\n";
          } else {
            const viewport = page.getViewport({ scale: o.scale });
            if (viewport.width * viewport.height > 40e6)
              throw new Error("Page resolution is too large.");
            const canvas = doc.canvasFactory.create(
              viewport.width,
              viewport.height,
            );
            await page.render({ canvasContext: canvas.context, viewport })
              .promise;
            await write(
              `${i + 1}-page-${n}.png`,
              canvas.canvas.toBuffer("image/png"),
            );
            doc.canvasFactory.destroy(canvas);
          }
        }
        if (id === "pdf-text") {
          resultText = all;
          await write(`${i + 1}-text.txt`, all);
        }
      } finally {
        await task.destroy();
      }
    }
  } else if (id.startsWith("pdf-") || id === "text-pdf") {
    if (id === "text-pdf") {
      const doc = await PDFDocument.create(),
        font = await doc.embedFont(StandardFonts.Helvetica);
      let page = doc.addPage(),
        y = 790;
      for (const line of text.split(/\r?\n/)) {
        let current = "";
        for (const word of line.split(" ")) {
          const candidate = current ? current + " " + word : word;
          try {
            if (font.widthOfTextAtSize(candidate, 11) > 490 && current) {
              page.drawText(current, { x: 45, y, size: 11, font });
              y -= 16;
              current = word;
            } else current = candidate;
          } catch {
            throw new Error(
              "This PDF tool uses a Latin font. Convert unsupported scripts with a Unicode-capable document engine.",
            );
          }
          if (y < 45) {
            page = doc.addPage();
            y = 790;
          }
        }
        page.drawText(current, { x: 45, y, size: 11, font });
        y -= 16;
        if (y < 45) {
          page = doc.addPage();
          y = 790;
        }
      }
      await write("text.pdf", await doc.save());
    } else
      for (const [i, file] of files.entries()) {
        check();
        const doc = await PDFDocument.load(await fs.readFile(file));
        if (id === "pdf-split") {
          for (let n = 0; n < doc.getPageCount(); n++) {
            check();
            const single = await PDFDocument.create();
            single.addPage((await single.copyPages(doc, [n]))[0]);
            await write(`${i + 1}-page-${n + 1}.pdf`, await single.save());
          }
          continue;
        }
        if (id === "pdf-delete") {
          if (
            o.start > o.end ||
            o.end > doc.getPageCount() ||
            o.end - o.start + 1 === doc.getPageCount()
          )
            throw new Error(
              "Choose a valid range and leave at least one page.",
            );
          for (let n = o.end - 1; n >= o.start - 1; n--) doc.removePage(n);
        }
        if (id === "pdf-edit-info") {
          doc.setTitle(o.title);
          doc.setAuthor(o.author);
        }
        if (id === "pdf-number" || id === "pdf-watermark") {
          const font = await doc.embedFont(StandardFonts.Helvetica);
          doc.getPages().forEach((p, n) => {
            if (id === "pdf-number")
              p.drawText(String(n + 1), {
                x: p.getWidth() / 2,
                y: 18,
                size: 10,
                font,
                color: rgb(0.3, 0.3, 0.3),
              });
            else
              p.drawText(o.label, {
                x: 30,
                y: p.getHeight() / 2,
                size: Math.min(48, p.getWidth() / Math.max(o.label.length, 1)),
                font,
                color: rgb(0.35, 0.4, 0.35),
                opacity: 0.22,
                rotate: degrees(25),
              });
          });
        }
        await write(`${i + 1}-document.pdf`, await doc.save());
      }
  } else if (id.startsWith("image-")) {
    if (id === "image-contact") {
      const columns = Math.round(o.columns),
        size = Math.round(o.width),
        rows = Math.ceil(files.length / columns);
      const tiles = [];
      for (const [i, file] of files.entries()) {
        check();
        tiles.push({
          input: await sharp(file)
            .rotate()
            .resize(size, size, { fit: "contain", background: "#f4f2ec" })
            .png()
            .toBuffer(),
          left: (i % columns) * size,
          top: Math.floor(i / columns) * size,
        });
      }
      await write(
        "contact-sheet.png",
        await sharp({
          create: {
            width: columns * size,
            height: rows * size,
            channels: 3,
            background: "#f4f2ec",
          },
        })
          .composite(tiles)
          .png()
          .toBuffer(),
      );
    } else
      for (const [i, file] of files.entries()) {
        check();
        const raw = await sharp(file).rotate().png().toBuffer(),
          meta = await sharp(raw).metadata();
        let image = sharp(raw);
        if (id === "image-pixelate") {
          const tiny = await image
            .resize(
              Math.max(1, Math.round(meta.width / o.block)),
              Math.max(1, Math.round(meta.height / o.block)),
              { fit: "fill" },
            )
            .png()
            .toBuffer();
          image = sharp(tiny).resize(meta.width, meta.height, {
            kernel: "nearest",
            fit: "fill",
          });
        }
        if (id === "image-tint") image = image.tint(o.color);
        if (id === "image-threshold")
          image = image.threshold(Math.round(o.threshold));
        if (id === "image-rounded") {
          const mask = Buffer.from(
            `<svg width="${meta.width}" height="${meta.height}"><rect width="100%" height="100%" rx="${Math.min(o.radius, meta.width / 2, meta.height / 2)}" fill="white"/></svg>`,
          );
          image = image.composite([{ input: mask, blend: "dest-in" }]);
        }
        if (id === "image-watermark") {
          const size = Math.max(12, Math.round(meta.width / 28));
          const overlay = Buffer.from(
            `<svg width="${meta.width}" height="${meta.height}"><rect y="${meta.height - size * 2.5}" width="100%" height="${size * 2.5}" fill="#18231b" opacity="${o.opacity}"/><text x="${size}" y="${meta.height - size * 0.7}" fill="white" font-family="sans-serif" font-size="${size}">${escape(o.label)}</text></svg>`,
          );
          image = image.composite([{ input: overlay }]);
        }
        if (id === "image-palette") {
          const pixels = await image
              .resize(80, 80, { fit: "inside" })
              .removeAlpha()
              .raw()
              .toBuffer(),
            counts = new Map();
          for (let p = 0; p < pixels.length; p += 3) {
            const c = [pixels[p], pixels[p + 1], pixels[p + 2]].map((x) =>
                Math.min(255, Math.round(x / 32) * 32),
              ),
              key =
                "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
            counts.set(key, (counts.get(key) || 0) + 1);
          }
          resultText = JSON.stringify(
            [...counts]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([hex, count]) => ({
                hex,
                percent: Math.round((count / (pixels.length / 3)) * 1000) / 10,
              })),
            null,
            2,
          );
          await write(`${i + 1}-palette.json`, resultText);
        } else await write(`${i + 1}-image.png`, await image.png().toBuffer());
      }
  } else {
    resultText = textExtra(id, text, o);
    await write("result.txt", resultText);
  }
  check();
  return { outputs, text: resultText };
}
