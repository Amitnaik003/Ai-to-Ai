const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

function generatePNG(width, height) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  // Center & parameters
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44; // squircle radius
  const cornerR = width * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pOffset = rowOffset + 1 + x * 4;

      // Distance from squircle corners
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const limit = radius;
      const cornerLimit = radius - cornerR;

      let inSquircle = false;
      let alpha = 0;

      if (dx <= limit && dy <= limit) {
        if (dx <= cornerLimit || dy <= cornerLimit) {
          inSquircle = true;
          alpha = 255;
        } else {
          const cornerDist = Math.hypot(dx - cornerLimit, dy - cornerLimit);
          if (cornerDist <= cornerR) {
            inSquircle = true;
            // Anti-aliasing edge
            alpha = Math.min(255, Math.max(0, Math.round((cornerR - cornerDist + 0.5) * 255)));
          }
        }
      }

      if (!inSquircle || alpha === 0) {
        rawData[pOffset] = 0;
        rawData[pOffset + 1] = 0;
        rawData[pOffset + 2] = 0;
        rawData[pOffset + 3] = 0;
        continue;
      }

      // Base gradient: Deep Indigo (#4338ca) to Vibrant Violet (#7c3aed)
      const gradT = (x + y) / (width + height);
      let r = Math.round(67 + gradT * (124 - 67));
      let g = Math.round(56 + gradT * (58 - 56));
      let b = Math.round(202 + gradT * (237 - 202));

      // Draw stylized Capsule (pill) in center
      // Capsule angle: -30 degrees
      const nx = (x - cx) / width;
      const ny = (y - cy) / height;

      // Rotate by 35 degrees
      const angle = 0.61;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = nx * cosA - ny * sinA;
      const ry = nx * sinA + ny * cosA;

      // Capsule geometry: length along rx, width along ry
      const capLen = 0.16;
      const capRadius = 0.09;
      const clampedRx = Math.max(-capLen, Math.min(capLen, rx));
      const distToCapsule = Math.hypot(rx - clampedRx, ry);

      if (distToCapsule <= capRadius) {
        // Inner capsule gradient (pure white to soft ice-blue)
        const capT = (rx + capLen) / (2 * capLen);
        if (rx < 0) {
          // Left half: clean white with subtle sheen
          r = Math.round(250 + rx * 20);
          g = Math.round(250 + rx * 20);
          b = 255;
        } else {
          // Right half: cyan/violet accent transfer
          r = Math.round(99 + capT * 120);
          g = Math.round(102 + capT * 80);
          b = 255;
        }

        // Inner divider stripe
        if (Math.abs(rx) < 0.012) {
          r = 49;
          g = 46;
          b = 129;
        }
      } else if (distToCapsule <= capRadius + 0.02) {
        // Subtle glow outline around the capsule
        const glowFactor = (capRadius + 0.02 - distToCapsule) / 0.02;
        r = Math.round(r * (1 - glowFactor) + 255 * glowFactor);
        g = Math.round(g * (1 - glowFactor) + 255 * glowFactor);
        b = 255;
      }

      // Live indicator dot at top-right
      const dotDx = x - (cx + radius * 0.6);
      const dotDy = y - (cy - radius * 0.6);
      const dotDist = Math.hypot(dotDx, dotDy);
      const dotR = width * 0.065;

      if (dotDist <= dotR) {
        // Emerald live dot (#10b981)
        r = 16;
        g = 185;
        b = 129;
      } else if (dotDist <= dotR + 2) {
        // White border ring for dot
        r = 255;
        g = 255;
        b = 255;
      }

      rawData[pOffset] = r;
      rawData[pOffset + 1] = g;
      rawData[pOffset + 2] = b;
      rawData[pOffset + 3] = alpha;
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate SVG Favicon
function generateSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="capsuleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#c7d2fe" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#312e81" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background squircle -->
  <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#bgGrad)" filter="url(#shadow)" />

  <!-- Subtle inner border -->
  <rect x="34" y="34" width="444" height="444" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4" />

  <!-- Main Capsule / AI Transfer Icon -->
  <g transform="translate(256, 256) rotate(-35)">
    <!-- Pill Capsule Body -->
    <rect x="-130" y="-55" width="260" height="110" rx="55" fill="url(#capsuleGrad)" filter="url(#shadow)" />
    
    <!-- Right side transfer half -->
    <path d="M 0,-55 L 75,-55 A 55,55 0 0,1 75,55 L 0,55 Z" fill="url(#accentGrad)" />
    
    <!-- Central Divider -->
    <line x1="0" y1="-55" x2="0" y2="55" stroke="#4338ca" stroke-width="8" stroke-linecap="round" />

    <!-- Core node sparkles -->
    <circle cx="-60" cy="0" r="14" fill="#6366f1" />
    <circle cx="60" cy="0" r="14" fill="#ffffff" />
  </g>

  <!-- Live Pulse Dot -->
  <circle cx="395" cy="115" r="26" fill="#10b981" stroke="#ffffff" stroke-width="6" />
</svg>`;
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Write 256x256 PNG for assets/icon.png
const png256 = generatePNG(256, 256);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png256);
console.log('Generated assets/icon.png (256x256, ' + png256.length + ' bytes)');

// 2. Write 512x512 PNG for assets/icon512.png
const png512 = generatePNG(512, 512);
fs.writeFileSync(path.join(assetsDir, 'icon512.png'), png512);
console.log('Generated assets/icon512.png (512x512, ' + png512.length + ' bytes)');

// 3. Write favicon.svg and favicon.png
const svg = generateSVG();
fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), svg, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), png256);
console.log('Generated assets/favicon.svg & assets/favicon.png');
