/**
 * UMBRA Icon Generator
 * Creates application icons (PNG and ICO) for the UMBRA project
 * 
 * Usage: node scripts/generate-icons.js
 */

const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Colors
const GRADIENT_START = '#1a1a2e';
const GRADIENT_END = '#16213e';
const TWITCH_PURPLE = '#9147ff';
const GLOW_COLOR = '#9147ff40';

// Icon sizes for ICO
const ICO_SIZES = [16, 32, 48, 256];
const PNG_SIZE = 512;

/**
 * Create SVG for the icon
 */
function createIconSvg(size) {
  const fontSize = Math.round(size * 0.55);
  const glowSize = Math.round(size * 0.4);
  const yOffset = Math.round(size * 0.05);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${GRADIENT_START}"/>
      <stop offset="100%" style="stop-color:${GRADIENT_END}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${Math.round(size * 0.03)}" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="innerGlow">
      <feFlood flood-color="${TWITCH_PURPLE}" flood-opacity="0.3"/>
      <feComposite in2="SourceAlpha" operator="in"/>
      <feGaussianBlur stdDeviation="${Math.round(size * 0.02)}"/>
      <feComposite in2="SourceAlpha" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Rounded background -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="url(#bg)"/>
  
  <!-- Subtle border -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" 
        fill="none" stroke="${TWITCH_PURPLE}" stroke-opacity="0.3" stroke-width="${Math.max(1, Math.round(size * 0.01))}"/>
  
  <!-- Glow circle behind U -->
  <circle cx="${size / 2}" cy="${size / 2}" r="${glowSize}" fill="${GLOW_COLOR}" filter="url(#glow)"/>
  
  <!-- Letter U -->
  <text x="${size / 2}" y="${(size / 2) + (fontSize * 0.35) + yOffset}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="bold" 
        fill="${TWITCH_PURPLE}" 
        text-anchor="middle"
        filter="url(#innerGlow)">U</text>
</svg>`;
}

/**
 * Generate PNG icon
 */
async function generatePng(size, outputPath) {
  const svg = createIconSvg(size);
  const svgBuffer = Buffer.from(svg);
  
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  
  console.log(`✓ Created ${path.basename(outputPath)} (${size}x${size})`);
}

/**
 * Generate ICO from PNG files
 */
async function generateIco(pngPaths, outputPath) {
  const pngBuffers = pngPaths.map(p => fs.readFileSync(p));
  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(outputPath, icoBuffer);
  console.log(`✓ Created ${path.basename(outputPath)} (multi-size: ${ICO_SIZES.join(', ')})`);
}

/**
 * Generate installer graphics (BMP files)
 */
async function generateInstallerGraphics() {
  // Welcome/Sidebar: 164x314
  const sidebarSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="164" height="314" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sbg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${GRADIENT_START}"/>
      <stop offset="100%" style="stop-color:${GRADIENT_END}"/>
    </linearGradient>
  </defs>
  <rect width="164" height="314" fill="url(#sbg)"/>
  <text x="82" y="157" font-family="Arial" font-size="72" font-weight="bold" 
        fill="${TWITCH_PURPLE}" text-anchor="middle" dominant-baseline="middle">U</text>
  <text x="82" y="220" font-family="Arial" font-size="16" font-weight="bold" 
        fill="#ffffff" text-anchor="middle">UMBRA</text>
  <text x="82" y="240" font-family="Arial" font-size="10" 
        fill="#888888" text-anchor="middle">Stream Overlay</text>
</svg>`;

  // Header: 150x57
  const headerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${GRADIENT_START}"/>
      <stop offset="100%" style="stop-color:${GRADIENT_END}"/>
    </linearGradient>
  </defs>
  <rect width="150" height="57" fill="url(#hbg)"/>
  <text x="10" y="35" font-family="Arial" font-size="28" font-weight="bold" 
        fill="${TWITCH_PURPLE}">U</text>
  <text x="38" y="35" font-family="Arial" font-size="20" font-weight="bold" 
        fill="#ffffff">MBRA</text>
</svg>`;

  // Generate sidebar (will be used as welcome.bmp and sidebar.bmp)
  await sharp(Buffer.from(sidebarSvg))
    .flatten({ background: { r: 26, g: 26, b: 46 } })
    .resize(164, 314)
    .toFile(path.join(ASSETS_DIR, 'welcome.bmp'));
  console.log('✓ Created welcome.bmp (164x314)');

  await sharp(Buffer.from(sidebarSvg))
    .flatten({ background: { r: 26, g: 26, b: 46 } })
    .resize(164, 314)
    .toFile(path.join(ASSETS_DIR, 'sidebar.bmp'));
  console.log('✓ Created sidebar.bmp (164x314)');

  // Generate header
  await sharp(Buffer.from(headerSvg))
    .flatten({ background: { r: 26, g: 26, b: 46 } })
    .resize(150, 57)
    .toFile(path.join(ASSETS_DIR, 'header.bmp'));
  console.log('✓ Created header.bmp (150x57)');
}

/**
 * Main function
 */
async function main() {
  console.log('\n🎨 UMBRA Icon Generator\n');
  console.log('─'.repeat(40));

  // Ensure assets directory exists
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  // Create temp directory for intermediate files
  const tempDir = path.join(__dirname, '..', '.icon-temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Generate main PNG icon (512x512)
    const mainPngPath = path.join(ASSETS_DIR, 'icon.png');
    await generatePng(PNG_SIZE, mainPngPath);

    // Generate PNG for each ICO size
    const tempPngPaths = [];
    for (const size of ICO_SIZES) {
      const tempPath = path.join(tempDir, `icon-${size}.png`);
      await generatePng(size, tempPath);
      tempPngPaths.push(tempPath);
    }

    // Generate ICO
    const icoPath = path.join(ASSETS_DIR, 'icon.ico');
    await generateIco(tempPngPaths, icoPath);

    // Generate installer graphics
    console.log('');
    await generateInstallerGraphics();

    // Cleanup temp files
    for (const p of tempPngPaths) {
      fs.unlinkSync(p);
    }
    fs.rmdirSync(tempDir);

    console.log('\n─'.repeat(40));
    console.log('✅ All icons generated successfully!\n');
    console.log('Files created:');
    console.log('  - assets/icon.png (512x512 - tray, macOS)');
    console.log('  - assets/icon.ico (16, 32, 48, 256 - Windows)');
    console.log('  - assets/welcome.bmp (164x314 - installer sidebar)');
    console.log('  - assets/sidebar.bmp (164x314 - installer sidebar)');
    console.log('  - assets/header.bmp (150x57 - installer header)\n');

  } catch (error) {
    console.error('\n❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

main();
