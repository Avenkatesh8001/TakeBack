# Quick Installation Guide

## Step 1: Create Icons

Since Chrome extensions require PNG icons, you need to create them:

### Option A: Use the HTML Generator (Recommended)
1. Open `create-png-icons.html` in Chrome
2. Click "Download" for each icon size
3. Save files to `icons/` folder as:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### Option B: Use Any Images
1. Create or find three PNG images (16x16, 48x48, 128x128 pixels)
2. Name them `icon16.png`, `icon48.png`, `icon128.png`
3. Place them in the `icons/` folder

### Option C: Online Converter
1. Run: `node create-icons.js` (creates SVG files)
2. Upload SVG files to https://svgtopng.com/
3. Download as PNG with correct sizes
4. Save to `icons/` folder

## Step 2: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `predictive-mute-extension` folder
5. Extension should appear with a blue icon

## Step 3: Test It

1. Go to https://meet.google.com (or any Zoom meeting)
2. Look for green indicator in bottom-right: "🛡️ Predictive Mute Active"
3. Click any input field and type: "I will share my password hunter2"
4. Press Enter
5. You should see a red alert: "🔇 MUTED BEFORE SENSITIVE WORD"

## Troubleshooting

**"Extension failed to load"**
- Make sure PNG icons exist in `icons/` folder
- Check that all files are present: manifest.json, background.js, popup.html, popup.js, content.js, styles.css

**"No indicator on page"**
- Refresh the meeting tab
- Check browser console for errors (F12)
- Make sure you're on meet.google.com or zoom.us domain

**"Detection not working"**
- Click the extension icon and verify it's enabled (checkbox checked)
- Make sure lookahead is set to 2 or higher
- Press Enter after typing to trigger detection

## Demo Keywords

Default sensitive keywords that will trigger mute:
- password
- credit
- card
- confidential
- secret
- ssn
- bank
- project x

Customize these in the extension popup!
