#!/usr/bin/env node
// Generate placeholder icons until proper icons are created
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Minimal valid PNG generator (1x1 green pixel scaled would need canvas)
// Instead, create a simple SVG-based approach and copy the logo
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Copy logo.svg as the icon source for electron-builder
const logoSvg = path.join(__dirname, '..', 'logo.svg');
if (fs.existsSync(logoSvg)) {
  fs.copyFileSync(logoSvg, path.join(iconsDir, 'icon.svg'));
  console.log('Copied logo.svg to assets/icons/icon.svg');
}

// electron-builder can use SVG directly for some targets,
// but needs PNGs for others. For now, create an icon.png symlink
// to the SVG and document that proper PNGs should be generated.
console.log('Note: Install librsvg2-bin (rsvg-convert) or inkscape to generate PNG icons:');
console.log('  sudo apt install librsvg2-bin');
console.log('  rsvg-convert -w 512 -h 512 logo.svg -o assets/icons/512x512.png');
sizes.forEach(s => {
  console.log(`  rsvg-convert -w ${s} -h ${s} logo.svg -o assets/icons/${s}x${s}.png`);
});
