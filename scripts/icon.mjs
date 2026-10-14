import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
// A small original vector-like equalizer mark, rasterized without external assets.
const size = 256;
const pixels = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const rounded =
      Math.hypot(
        Math.max(0, Math.abs(x - 127.5) - 83),
        Math.max(0, Math.abs(y - 127.5) - 83),
      ) < 38;
    const bar = [
      [62, 93, 31, 70],
      [113, 55, 31, 146],
      [164, 78, 31, 101],
    ].some(([bx, by, w, h]) => x >= bx && x < bx + w && y >= by && y < by + h);
    pixels.set(bar ? [102, 227, 196, 255] : [22, 29, 37, rounded ? 255 : 0], i);
  }
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, value) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(value.length);
  const data = Buffer.concat([Buffer.from(type), value]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(data));
  return Buffer.concat([length, data, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);
await mkdir("resources", { recursive: true });
await mkdir("dist", { recursive: true });
await writeFile("resources/icon.png", png);
await writeFile("dist/icon.png", png);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile("resources/icon.ico", Buffer.concat([ico, png]));
