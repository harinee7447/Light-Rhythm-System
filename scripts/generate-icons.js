import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const outDir = path.join(process.cwd(), 'Frontend');

// 1. Generate SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#090d16"/>
    </radialGradient>
    <linearGradient id="circadianGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background base -->
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)" />
  <rect width="512" height="512" rx="112" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />

  <!-- Circadian orbit circle -->
  <circle cx="256" cy="256" r="160" fill="none" stroke="url(#circadianGrad)" stroke-width="14" stroke-linecap="round" stroke-dasharray="720 180" filter="url(#glow)" />

  <!-- Central luminous core (Sun & Rhythm symbol) -->
  <circle cx="256" cy="256" r="64" fill="url(#sunGrad)" filter="url(#glow)" />
  <circle cx="256" cy="256" r="48" fill="#ffffff" opacity="0.25" />

  <!-- Radiating circadian rhythm beams -->
  <line x1="256" y1="46" x2="256" y2="76" stroke="#fbbf24" stroke-width="8" stroke-linecap="round" />
  <line x1="256" y1="436" x2="256" y2="466" stroke="#6366f1" stroke-width="8" stroke-linecap="round" />
  <line x1="46" y1="256" x2="76" y2="256" stroke="#f59e0b" stroke-width="8" stroke-linecap="round" />
  <line x1="436" y1="256" x2="466" y2="256" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" />

  <!-- Wave overlay -->
  <path d="M 176 256 Q 216 216, 256 256 T 336 256" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.9" />
</svg>`;

fs.writeFileSync(path.join(outDir, 'icon.svg'), svgContent, 'utf-8');
console.log('✓ Created Frontend/icon.svg');

// PNG encoder helper
function createPng(width, height, drawFn) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * rowSize + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Draw renderer for app icons
function renderIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const scale = isMaskable ? 0.72 : 0.88; // Safe zone padding for maskable
  const dx = (x - cx) / scale;
  const dy = (y - cy) / scale;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background deep dark circadian color #0a0e17 -> #151d2a
  const bgDistRatio = Math.min(1, Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (w * 0.7));
  const bgR = Math.round(18 - bgDistRatio * 10);
  const bgG = Math.round(26 - bgDistRatio * 14);
  const bgB = Math.round(40 - bgDistRatio * 20);

  // Outer orbital ring (radius ~ 150/256 of radius)
  const ringR = (w / 2) * 0.62;
  const ringDist = Math.abs(dist - ringR);
  const ringThickness = (w / 2) * 0.055;

  // Center Sun Core (radius ~ 60/256 of radius)
  const coreR = (w / 2) * 0.25;

  let r = bgR;
  let g = bgG;
  let b = bgB;
  let a = 255;

  // Outer ring glow
  if (ringDist < ringThickness * 2) {
    const alphaFactor = Math.max(0, 1 - ringDist / (ringThickness * 2));
    // Gradient along circle: top-left is amber/gold, bottom-right is cyan/indigo
    const angle = Math.atan2(dy, dx);
    const t = (angle + Math.PI) / (2 * Math.PI); // 0 to 1

    const ringRColor = Math.round(245 * (1 - t) + 99 * t);
    const ringGColor = Math.round(158 * (1 - t) + 102 * t);
    const ringBColor = Math.round(11 * (1 - t) + 241 * t);

    r = Math.round(r * (1 - alphaFactor) + ringRColor * alphaFactor);
    g = Math.round(g * (1 - alphaFactor) + ringGColor * alphaFactor);
    b = Math.round(b * (1 - alphaFactor) + ringBColor * alphaFactor);
  }

  // Core glow & body
  if (dist < coreR * 1.8) {
    if (dist <= coreR) {
      // Core center
      const coreAlpha = 1 - dist / coreR;
      r = Math.round(251 * (1 - coreAlpha * 0.3) + 255 * (coreAlpha * 0.3));
      g = Math.round(191 * (1 - coreAlpha * 0.3) + 255 * (coreAlpha * 0.3));
      b = Math.round(36 * (1 - coreAlpha * 0.3) + 200 * (coreAlpha * 0.3));
    } else {
      // Glow aura
      const auraAlpha = Math.max(0, 1 - (dist - coreR) / (coreR * 0.8)) * 0.75;
      r = Math.round(r * (1 - auraAlpha) + 245 * auraAlpha);
      g = Math.round(g * (1 - auraAlpha) + 158 * auraAlpha);
      b = Math.round(b * (1 - auraAlpha) + 11 * auraAlpha);
    }
  }

  // Circadian sine-wave across center
  const waveY = Math.sin((dx / (w * 0.3)) * Math.PI) * (h * 0.05);
  const waveDist = Math.abs(dy - waveY);
  if (Math.abs(dx) < w * 0.32 && waveDist < h * 0.016) {
    const waveAlpha = Math.max(0, 1 - waveDist / (h * 0.016));
    r = Math.round(r * (1 - waveAlpha) + 255 * waveAlpha);
    g = Math.round(g * (1 - waveAlpha) + 255 * waveAlpha);
    b = Math.round(b * (1 - waveAlpha) + 255 * waveAlpha);
  }

  return [r, g, b, a];
}

// Generate PNGs
console.log('Generating 192x192...');
const pwa192 = createPng(192, 192, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), pwa192);

console.log('Generating 512x512...');
const pwa512 = createPng(512, 512, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), pwa512);

console.log('Generating 512x512 maskable...');
const pwaMaskable512 = createPng(512, 512, (x, y, w, h) => renderIcon(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), pwaMaskable512);

console.log('Generating apple-touch-icon 180x180...');
const appleTouch180 = createPng(180, 180, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleTouch180);

console.log('Generating favicon 64x64...');
const favicon64 = createPng(64, 64, (x, y, w, h) => renderIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'favicon.png'), favicon64);

console.log('All PWA icons generated successfully!');
