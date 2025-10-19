#!/usr/bin/env node

// Simple script to create base64-encoded 1x1 colored PNG placeholders
// These are minimal valid PNGs that Chrome will accept

const fs = require('fs');
const path = require('path');

// Base64-encoded 1x1 blue PNG (smallest valid PNG)
// This is a solid blue pixel that will work as placeholder
const bluePNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVR42mNgYGD4TwQGBkaGkf' +
  '+JwqOGjBoyasiQNYSBgYHhPxEYAFqGAwehWOeJAAAAAElFTkSuQmCC',
  'base64'
);

const blue48PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAARklEQVR42u3OMQEAAAgDoK1/' +
  'aM3g1XBJQQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIArBB' +
  '+UAAHJwCdLAAAAAElFTkSuQmCC',
  'base64'
);

const sizes = {
  'icon16.png': 16,
  'icon48.png': 48,
  'icon128.png': 128
};

const iconsDir = path.join(__dirname, 'icons');

// Create a simple colored square PNG for each size
// These are minimal valid PNGs that Chrome will accept
console.log('Creating placeholder PNG icons...\n');

Object.keys(sizes).forEach(filename => {
  const filepath = path.join(iconsDir, filename);

  // Use the base PNG (we'll use the same for all sizes as placeholders)
  // In a real scenario you'd scale these properly
  fs.writeFileSync(filepath, bluePNG);

  console.log(`✅ Created ${filename}`);
});

console.log('\n✅ All PNG icons created successfully!');
console.log('\n📝 Note: These are minimal placeholder icons.');
console.log('For better quality icons, use create-png-icons.html in your browser.');
console.log('\nYou can now load the extension in Chrome:');
console.log('1. Go to chrome://extensions');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked"');
console.log('4. Select the predictive-mute-extension folder');
