import fs from "fs";
import path from "path";
import zlib from "zlib";

function createPNG(size, r, g, b) {
  const width = size;
  const height = size;

  // Each scanline: filter byte (0) + 4 bytes per pixel (RGBA)
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineSize;
    rawData[lineOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 4;
      // Simple gradient/circle pattern
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width / 2 - 1;

      if (dist <= radius) {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, "ascii");
    const body = Buffer.concat([typeBuf, data]);

    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);

    return Buffer.concat([len, body, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", deflated);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Purple/indigo theme color: rgb(99, 102, 241)
fs.writeFileSync(path.join(iconsDir, "icon16.png"), createPNG(16, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, "icon48.png"), createPNG(48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, "icon128.png"), createPNG(128, 99, 102, 241));
console.log("Icons created successfully in public/icons/");
