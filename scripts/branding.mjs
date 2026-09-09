import fs from "node:fs/promises";
import sharp from "sharp";
await fs.mkdir("build", { recursive: true });
const mark =
  '<path d="M64 30 100 49 64 69 28 49Z M28 64 64 84 100 64 M28 79 64 99 100 79" fill="none" stroke="#e9f3df" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128"><rect width="128" height="128" rx="36" fill="#356347"/>${mark}</svg>`;
await fs.writeFile("build/icon.svg", svg);
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await fs.writeFile("build/icon.png", png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await fs.writeFile("build/icon.ico", Buffer.concat([header, png]));
async function bmp(name, width, height, svg) {
  const raw = await sharp(Buffer.from(svg))
    .resize(width, height)
    .removeAlpha()
    .raw()
    .toBuffer();
  const stride = Math.ceil((width * 3) / 4) * 4,
    pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3,
        dst = (height - 1 - y) * stride + x * 3;
      pixels[dst] = raw[src + 2];
      pixels[dst + 1] = raw[src + 1];
      pixels[dst + 2] = raw[src];
    }
  const h = Buffer.alloc(54);
  h.write("BM");
  h.writeUInt32LE(54 + pixels.length, 2);
  h.writeUInt32LE(54, 10);
  h.writeUInt32LE(40, 14);
  h.writeInt32LE(width, 18);
  h.writeInt32LE(height, 22);
  h.writeUInt16LE(1, 26);
  h.writeUInt16LE(24, 28);
  h.writeUInt32LE(pixels.length, 34);
  await fs.writeFile(name, Buffer.concat([h, pixels]));
}
await bmp(
  "build/sidebar.bmp",
  164,
  314,
  `<svg xmlns="http://www.w3.org/2000/svg" width="328" height="628"><rect width="328" height="628" fill="#d3e9ce"/><g transform="translate(60 52) scale(1.6)"><rect width="128" height="128" rx="38" fill="#356347"/>${mark}</g><text x="30" y="326" font-family="Segoe UI" font-size="34" font-weight="700" fill="#243d2b">switchyard</text><text x="32" y="367" font-family="Segoe UI" font-size="18" fill="#41614b">Your everyday</text><text x="32" y="394" font-family="Segoe UI" font-size="18" fill="#41614b">workshop.</text><rect x="-25" y="480" width="230" height="190" rx="72" fill="#edf1c8" transform="rotate(-15 90 560)"/><rect x="190" y="475" width="150" height="160" rx="45" fill="#93b99a" transform="rotate(15 260 550)"/></svg>`,
);
await bmp(
  "build/header.bmp",
  150,
  57,
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="114"><rect width="300" height="114" fill="#fffefa"/><g transform="translate(200 9) scale(.75)"><rect width="128" height="128" rx="36" fill="#356347"/>${mark}</g></svg>`,
);
