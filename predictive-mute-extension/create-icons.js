// Simple script to create icon placeholders
// Run with: node create-icons.js

const fs = require('fs');
const path = require('path');

// Create a simple PNG data URL for icons (1x1 colored pixel as placeholder)
// For a real hackathon, you'd replace these with actual icon images

const sizes = [16, 48, 128];

const svgTemplate = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#4285f4"/>
  <g transform="translate(${size * 0.15}, ${size * 0.15})">
    <path d="M${size * 0.35} ${size * 0.1} L${size * 0.35} ${size * 0.4} C${size * 0.35} ${size * 0.55} ${size * 0.27} ${size * 0.63} ${size * 0.175} ${size * 0.68} C${size * 0.09} ${size * 0.63} ${size * 0} ${size * 0.55} ${size * 0} ${size * 0.4} L${size * 0} ${size * 0.1} L${size * 0.175} ${size * 0} Z"
          fill="white" stroke="white" stroke-width="${size * 0.015}"/>
    <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.1}" fill="#dc3545"/>
    <line x1="${size * 0.45}" y1="${size * 0.45}" x2="${size * 0.55}" y2="${size * 0.55}" stroke="white" stroke-width="${size * 0.025}" stroke-linecap="round"/>
  </g>
</svg>
`;

console.log('Creating icon placeholders...');

// For Chrome extensions, we can actually use SVG directly in some cases,
// but PNG is safer for compatibility. For this demo, we'll create simple colored squares.

// Note: To create actual PNG files, you would need a library like 'sharp' or 'canvas'
// For hackathon purposes, you can manually create these or use online converters

sizes.forEach(size => {
  const svg = svgTemplate(size);
  const filename = path.join(__dirname, 'icons', `icon${size}.svg`);
  fs.writeFileSync(filename, svg.trim());
  console.log(`Created ${filename}`);
});

console.log('\n⚠️  NOTE: Chrome extensions require PNG icons, not SVG.');
console.log('To complete the setup, convert the SVG files to PNG using:');
console.log('1. Online tool: https://svgtopng.com/');
console.log('2. Or install sharp: npm install sharp');
console.log('3. Or use any image editor to export as PNG');
console.log('\nFor quick hackathon demo, you can also:');
console.log('- Use any 16x16, 48x48, 128x128 PNG images');
console.log('- Name them icon16.png, icon48.png, icon128.png');
console.log('- Place in the icons/ folder');
