/**
 * 生成应用图标 icon.ico
 * 使用纯 Node.js，无需任何图片处理库
 * 创建 256x256 RGBA 图标，配色取自应用 CSS 主题色 (#667eea → #764ba2)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const PRIMARY = [0x66, 0x7e, 0xea];   // #667eea (R,G,B)
const SECONDARY = [0x76, 0x4b, 0xa2]; // #764ba2

// ---- 1. 生成原始 RGBA 像素数据 ----
// 从上到下渐变 + 中间一个圆形高光
const rawPixels = Buffer.alloc(SIZE * SIZE * 4);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const idx = (y * SIZE + x) * 4;
    const progress = y / SIZE; // 0→1 从上到下

    // 渐变混合
    const r = Math.round(PRIMARY[0] * (1 - progress) + SECONDARY[0] * progress);
    const g = Math.round(PRIMARY[1] * (1 - progress) + SECONDARY[1] * progress);
    const b = Math.round(PRIMARY[2] * (1 - progress) + SECONDARY[2] * progress);

    // 绘制圆角矩形遮罩（半径 ~40px）
    const cx = SIZE / 2, cy = SIZE / 2, rx = SIZE / 2 - 8, ry = SIZE / 2 - 8;
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    const cornerR = 48;
    let inside;
    if (dx > rx - cornerR && dy > ry - cornerR) {
      const dist = Math.sqrt((dx - (rx - cornerR)) ** 2 + (dy - (ry - cornerR)) ** 2);
      inside = dist <= cornerR;
    } else {
      inside = dx <= rx && dy <= ry;
    }

    // 未缩放时的简单圆角内部
    // 更简单的：做一个圆形图标 (直径 SIZE-16)
    const centerX = SIZE / 2, centerY = SIZE / 2;
    const radius = SIZE / 2 - 10;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const isInside = dist <= radius;
    const edgeSoft = 3; // 抗锯齿过渡宽度

    let alpha;
    if (isInside) {
      alpha = 255;
    } else if (dist <= radius + edgeSoft) {
      alpha = Math.round(255 * (1 - (dist - radius) / edgeSoft));
    } else {
      alpha = 0;
    }

    // 顶部高光
    const highlight = Math.max(0, 1 - Math.sqrt((x - centerX*0.7) ** 2 + (y - centerY*0.35) ** 2) / (radius * 0.8));
    const highlightAmount = Math.round(highlight * 40);

    rawPixels[idx]     = Math.min(255, r + highlightAmount);     // R
    rawPixels[idx + 1] = Math.min(255, g + highlightAmount);     // G
    rawPixels[idx + 2] = Math.min(255, b + highlightAmount);     // B
    rawPixels[idx + 3] = alpha;                                   // A
  }
}

// ---- 2. 创建 PNG ----
function createPNG(width, height, pixels) {
  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(6, 9);   // color type: RGBA
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace
  const ihdr = chunk('IHDR', ihdrData);

  // IDAT chunk — raw pixel data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw);
  const idat = chunk('IDAT', compressed);

  // IEND chunk
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crcVal = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ---- 3. 将 PNG 包装为 ICO ----
const pngData = createPNG(SIZE, SIZE, rawPixels);

// ICO 头部: reserved(2) + type(2) + count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);  // reserved
header.writeUInt16LE(1, 2);  // type: ICO
header.writeUInt16LE(1, 4);  // count: 1 image

// 目录项
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0);      // width (0=256)
entry.writeUInt8(0, 1);      // height (0=256)
entry.writeUInt8(0, 2);      // colors
entry.writeUInt8(0, 3);      // reserved
entry.writeUInt16LE(1, 4);   // planes
entry.writeUInt16LE(32, 6);  // bpp
entry.writeUInt32LE(pngData.length, 8);  // size
entry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

const ico = Buffer.concat([header, entry, pngData]);
const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
fs.writeFileSync(icoPath, ico);
console.log('✓ 图标已生成:', icoPath, `(${ico.length} bytes)`);
