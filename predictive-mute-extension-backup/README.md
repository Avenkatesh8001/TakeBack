# Predictive Mute Chrome Extension

A Chrome extension that detects and prevents accidental disclosure of sensitive information during Google Meet and Zoom calls by analyzing speech/text patterns and muting before sensitive keywords are spoken.

## Overview

This extension uses **lookahead analysis** to check upcoming words in real-time and automatically mutes your microphone before sensitive content is disclosed. Perfect for preventing accidental leaks during online meetings.

### Features

- **Predictive Detection**: Analyzes N words ahead to catch sensitive content before it's spoken
- **Real-time Monitoring**: Works on Google Meet and Zoom browser tabs
- **Customizable Keywords**: Define your own sensitive keywords (passwords, project names, etc.)
- **Visual Alerts**: Clear on-screen notifications when mute is triggered
- **Activity Logging**: Track all detection events in the popup
- **Quick Toggle**: Enable/disable monitoring with one click

## Installation

### Method 1: Load Unpacked Extension (Development)

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd predictive-mute-extension
   ```

2. **Create PNG icons** (required for Chrome)
   - Open `create-png-icons.html` in your browser
   - Click "Download" button for each icon size (16, 48, 128)
   - Save the downloaded files to the `icons/` folder as:
     - `icon16.png`
     - `icon48.png`
     - `icon128.png`

   **Alternative**: Use any image editor to create 16x16, 48x48, and 128x128 PNG images and save them with these names.

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `predictive-mute-extension` folder
   - The extension should now appear in your extensions list

4. **Pin the extension** (optional)
   - Click the puzzle icon in Chrome toolbar
   - Find "Predictive Mute for Meetings"
   - Click the pin icon to keep it visible

## Usage

### Quick Start

1. **Open a meeting tab**
   - Navigate to Google Meet (`meet.google.com`) or Zoom (`zoom.us`) in your browser
   - Join or start a meeting

2. **Configure settings**
   - Click the extension icon in Chrome toolbar
   - Set your preferred lookahead window (1-10 words, default: 2)
   - Add or modify sensitive keywords (comma-separated)
   - Click "Save Settings"

3. **Test the extension**
   - Type a message in any input field on the meeting page
   - Press Enter to trigger detection
   - If sensitive keywords are detected in the lookahead window, you'll see a red alert

### Default Sensitive Keywords

The extension comes pre-configured with these keywords:
- `password`
- `credit`
- `card`
- `confidential`
- `secret`
- `ssn`
- `bank`
- `project x`

You can customize this list in the extension popup.

### How It Works

1. **Input Monitoring**: The extension monitors keyboard input in meeting tabs
2. **Word Analysis**: When you press Enter, it analyzes the text word-by-word
3. **Lookahead Check**: For each word, it checks the next N words (configurable)
4. **Mute Trigger**: If a sensitive keyword is detected ahead, it immediately:
   - Shows a visual alert on screen
   - Logs the event
   - Simulates muting (alerts in demo mode)
   - Sets a red badge on the extension icon

### Visual Indicators

- **Bottom-right indicator**: Shows if the extension is active
  - 🛡️ Green = Active and monitoring
  - ⏸️ Gray = Paused
  - Click to toggle on/off

- **Mute alert**: Red overlay appears when sensitive content is detected
  - Shows the trigger word
  - Displays how many words ahead it was detected
  - Auto-dismisses after 3 seconds

## Test Cases

Try these examples to test the extension (type and press Enter):

### Should Trigger Mute

1. **"I will now share my password hunter2"**
   - Triggers at "password" (lookahead detects it before you finish typing)

2. **"Upload the credit card number now"**
   - Triggers at "credit" (or "card" depending on position)

3. **"The secret project x details are ready"**
   - Triggers at "secret" or "project x"

4. **"My ssn is 123-45-6789"**
   - Triggers at "ssn"

### Should NOT Trigger

1. **"This is our public roadmap open discussion"**
   - No sensitive keywords detected

2. **"Let's review the quarterly report"**
   - Safe content

3. **"I'll send you the link to the meeting"**
   - Safe content

## Configuration Options

### Lookahead Window
- **Range**: 1-10 words
- **Default**: 2 words
- **Recommendation**: 2-3 words for real-time speech, 4-5 for typed content

### Sensitive Keywords
- Case-insensitive matching
- Partial word matching (e.g., "pass" matches "password")
- Comma-separated list
- Can include multi-word phrases (e.g., "project x")

## Demo Notes

This is a **demonstration version** built for hackathon purposes. It currently:

### What Works
- ✅ Detects sensitive keywords in typed text
- ✅ Lookahead analysis (configurable window)
- ✅ Visual alerts and logging
- ✅ Settings persistence
- ✅ Real-time monitoring toggle

### Limitations (Demo Mode)
- ⚠️ **Actual muting is simulated** - Shows alert instead of muting microphone
- ⚠️ **Text-based input only** - Doesn't capture live audio/speech yet
- ⚠️ **Triggered by Enter key** - Not real-time speech-to-text

### Future Enhancements for Production

To make this production-ready, you would need to:

1. **WebRTC Audio Capture**
   ```javascript
   navigator.mediaDevices.getUserMedia({ audio: true })
     .then(stream => {
       // Process audio stream
       const audioContext = new AudioContext();
       const source = audioContext.createMediaStreamSource(stream);
       // Add speech-to-text processing
     });
   ```

2. **Speech-to-Text Integration**
   - Use Web Speech API (`webkitSpeechRecognition`)
   - Or integrate with Whisper API for better accuracy
   - Process audio chunks in real-time

3. **Actual Microphone Control**
   ```javascript
   // Find and click Google Meet mute button
   const muteBtn = document.querySelector('[data-is-muted="false"]');
   if (muteBtn) muteBtn.click();

   // Or disable audio tracks directly
   stream.getAudioTracks().forEach(track => track.enabled = false);
   ```

4. **Semantic Analysis**
   - Add LLM integration for context-aware detection
   - Use embeddings for similarity matching
   - Reduce false positives with better NLP

5. **Platform-Specific Integrations**
   - Google Meet: Hook into their WebRTC streams
   - Zoom: Interface with Zoom's web client APIs
   - Microsoft Teams, Slack Huddles, etc.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Popup UI   │◄────►│  Background  │                │
│  │  (Settings)  │      │   Service    │                │
│  └──────────────┘      │   Worker     │                │
│                        └──────────────┘                │
│                               ▲                          │
│                               │ IPC                      │
│                               ▼                          │
│  ┌─────────────────────────────────────────────┐       │
│  │         Content Script (Meeting Tab)         │       │
│  ├─────────────────────────────────────────────┤       │
│  │  • Monitor keyboard input                    │       │
│  │  • Analyze text with lookahead               │       │
│  │  • Detect sensitive keywords                 │       │
│  │  • Show alerts                               │       │
│  │  • Trigger mute (simulated)                  │       │
│  └─────────────────────────────────────────────┘       │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Google Meet / Zoom   │
              │    (Meeting Tab)      │
              └───────────────────────┘
```

### File Structure

```
predictive-mute-extension/
├── manifest.json              # Extension configuration (Manifest V3)
├── background.js             # Service worker for background tasks
├── popup.html                # Extension popup UI
├── popup.js                  # Popup logic and settings management
├── content.js                # Main detection logic (runs on meeting tabs)
├── styles.css                # Popup styling
├── icons/                    # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── create-icons.js           # Helper to generate SVG icons
├── create-png-icons.html     # Browser-based PNG icon generator
└── README.md                 # This file
```

## Troubleshooting

### Extension doesn't appear
- Make sure Developer mode is enabled in `chrome://extensions`
- Check that all PNG icons are present in the `icons/` folder
- Look for errors in the extension card

### Detection not working
- Verify you're on a Google Meet or Zoom tab
- Check that the extension is enabled (green indicator in bottom-right)
- Open DevTools Console (F12) and look for `[PredictiveMute]` logs
- Make sure you press Enter after typing

### Settings not saving
- Check Chrome's sync status
- Try using incognito mode to test without sync
- Check DevTools Console for storage errors

### No visual indicator on page
- The indicator appears in the bottom-right corner
- Make sure the content script loaded (check console)
- Try refreshing the meeting tab

## Development

### Debugging

1. **Content Script**:
   - Open DevTools on the meeting tab (F12)
   - Check Console for `[PredictiveMute]` messages
   - Use `chrome.storage.sync.get()` to inspect settings

2. **Background Service Worker**:
   - Go to `chrome://extensions`
   - Click "service worker" link under the extension
   - View logs and errors

3. **Popup**:
   - Right-click the extension icon → "Inspect popup"
   - Debug popup.js code

### Modifying the Code

- **Change detection logic**: Edit `content.js` → `shouldMute()` function
- **Add new keywords**: Edit `background.js` → default `sensitiveWords` array
- **Customize UI**: Edit `popup.html` and `styles.css`
- **Add new features**: Update `manifest.json` permissions as needed

## Privacy & Security

- **Local Processing**: All detection happens locally in your browser
- **No Data Collection**: This extension does not send data to external servers
- **Storage**: Settings are saved to Chrome Sync storage (encrypted by Chrome)
- **Permissions**: Only requests access to meeting sites and storage

### Permissions Explained

```json
{
  "activeTab": "Access current tab when extension is clicked",
  "scripting": "Inject content script into meeting tabs",
  "storage": "Save user settings and logs",
  "host_permissions": "Run on Google Meet and Zoom domains only"
}
```

## Contributing

This is a hackathon demo project. For production use, consider:

- Adding comprehensive tests
- Implementing actual WebRTC audio control
- Integrating real speech-to-text
- Supporting more meeting platforms
- Adding ML-based semantic analysis
- Implementing user authentication for team settings
- Creating a privacy-focused backend for shared keyword lists

## License

MIT License - Feel free to use, modify, and distribute.

## Credits

Built for hackathon demonstration of predictive security measures in online meetings.

---

**Note**: This extension is for demonstration purposes. For production deployment, implement proper WebRTC audio capture, speech-to-text, and microphone control as outlined in the Future Enhancements section.
