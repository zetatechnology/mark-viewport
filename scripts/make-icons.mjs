// Generates the extension icons (public/icons/*.png) without external deps.
// Draws an "M↓" glyph on a rounded square, rasterized with 4x4 supersampling.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [47, 111, 235];
const FG = [255, 255, 255];

// Shapes in a 128x128 design space.
const rects = [
  [18, 36, 31, 92], // M left stem
  [63, 36, 76, 92], // M right stem
  [91, 36, 103, 70], // arrow shaft
];
const polys = [
  [[18, 36], [31, 36], [47, 62], [63, 36], [76, 36], [47, 80]], // M middle V
  [[80, 66], [114, 66], [97, 92]], // arrow head
];

function inPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 128 - r);
  const cy = Math.min(Math.max(y, r), 128 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= 0 && x <= 128 && y >= 0 && y <= 128;
}

function isFg(x, y) {
  return rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) || polys.some((p) => inPoly(x, y, p));
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// `pad` is transparent padding in design units (the Web Store icon wants the
// artwork at 96x96 inside a 128x128 canvas).
function png(size, pad = 0) {
  const S = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const k = 128 / (128 - 2 * pad);
          const x = (((px + (sx + 0.5) / S) / size) * 128 - pad) * k;
          const y = (((py + (sy + 0.5) / S) / size) * 128 - pad) * k;
          if (inRoundRect(x, y, 24)) {
            bg++;
            if (isFg(x, y)) fg++;
          }
        }
      }
      const a = bg / (S * S);
      const t = bg ? fg / bg : 0;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - t) + FG[c] * t);
      raw[o + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(`public/icons/icon${size}.png`, png(size));
}
mkdirSync('store/assets', { recursive: true });
writeFileSync('store/assets/icon-store-128.png', png(128, 16));
console.log('Icons written to public/icons/ and store/assets/');
