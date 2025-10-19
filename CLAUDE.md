# CLAUDE.md
// instructions for claud 
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TakeBack is an Electron-based desktop overlay application designed to prevent accidental disclosure of confidential information during Google Meet calls. The app monitors audio in real-time, transcribes it using Whisper, analyzes it with an LLM for sensitive content, and can auto-mute when danger is detected.

**Current Status**: v0.1 - UI overlay complete with demo mode. Audio capture, Whisper integration, and LLM analysis are not yet implemented.

## Commands

```bash
# Start the Electron overlay app
npm start

# Install dependencies
npm install
```

## Architecture

### Electron Process Model

The app uses Electron's multi-process architecture:

**Main Process** (`main.js`):
- Creates a frameless, always-on-top, transparent window (400x600px)
- Window configuration: `frame: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`
- Handles IPC messages from renderer: `start-monitoring`, `stop-monitoring`, `update-sensitivity`
- Future: Will orchestrate audio capture and processing pipeline

**Renderer Process** (`renderer.js` + `index.html`):
- Uses `nodeIntegration: true` and `contextIsolation: false` for direct Node.js access
- Manages UI state and user interactions
- Communicates with main process via `ipcRenderer`
- Settings persisted to `localStorage` as JSON

### Planned Data Flow (Not Yet Implemented)

```
Audio Input → Whisper (Speech-to-Text) → LLM (Danger Analysis) → Decision Engine → Auto-Mute
```

### IPC Communication Protocol

**Renderer → Main**:
- `start-monitoring` with config object `{ sensitivity, keywords, autoMute }`
- `stop-monitoring` (no params)
- `update-sensitivity` with level (1-5)

**Main → Renderer**:
- `monitoring-status` with `{ status: 'started' | 'stopped' }`
- `danger-level-update` with `{ level: 0-100 }`
- `transcription-update` with `{ text: string, flagged: boolean }`

### Danger Level Thresholds

The danger level (0-100) triggers different UI states:
- **0-40**: Safe (green status dot)
- **41-70**: Moderate (yellow, active dot)
- **71-100**: Critical (red danger dot, auto-mute if enabled)

Thresholds are hardcoded in `renderer.js:122-144` in the `updateDangerLevel()` function.

### Settings Management

Settings object structure:
```javascript
{
  sensitivity: 1-5,        // Integer slider value
  keywords: string[],      // Array of confidential keywords
  autoMute: boolean        // Whether to auto-mute on danger
}
```

Settings are saved to `localStorage` with key `takeback-settings` and loaded on app initialization.

## Key Implementation Details

### Overlay Window Dragging

The header uses `-webkit-app-region: drag` CSS property to enable dragging, while child elements (buttons) use `-webkit-app-region: no-drag` to remain clickable. This is critical for the frameless window UX.

### Transparent Overlay Styling

The widget uses `backdrop-filter: blur(20px)` with `background: rgba(255, 255, 255, 0.95)` to create a frosted glass effect. This requires the main window to have `transparent: true`.

### Demo Simulation

`renderer.js:223-253` contains a `simulateMonitoring()` function that cycles through sample phrases every 3 seconds to demonstrate the UI without real audio processing. This should be removed or disabled when implementing actual audio capture.

### Collapsible Settings Panel

Settings section uses CSS transitions (`max-height: 0` → `max-height: 300px`) controlled by the `open` class. Toggle icon rotates 180deg when expanded. See `styles.css:238-268`.

## Critical TODOs for Full Implementation

1. **Audio Capture**: Implement system audio/microphone capture in main process
   - Consider using `navigator.mediaDevices.getUserMedia()` or native Node libraries
   - Need to capture both user's mic and system audio (Google Meet speakers)

2. **Whisper Integration**: Add Whisper for speech-to-text
   - Recommended: Use `whisper.cpp` for fast local processing
   - Alternative: Use OpenAI Whisper API
   - Target latency: <500ms for real-time feeling

3. **LLM Analysis**: Connect to LLM API for danger assessment
   - Send transcribed text chunks to LLM with context window
   - Stream JSON responses with danger level (0-100)
   - Consider using Claude or GPT-4 with custom system prompt

4. **Mute Control**: Implement system-level audio muting
   - macOS: Use `osascript` or native bindings to control mic
   - Need to detect and mute specifically for Google Meet

5. **Latency Optimization**: Sub-second response time is critical
   - Consider two-tier analysis: fast keyword detection → LLM for edge cases
   - Use embeddings for quick semantic similarity checks before full LLM call

## Electron Security Considerations

The app currently uses `nodeIntegration: true` and `contextIsolation: false`, which are insecure configurations. These were chosen for rapid prototyping. When implementing audio/API features, consider:
- Moving sensitive operations to main process
- Using `contextBridge` to expose only necessary APIs
- Enabling `contextIsolation: true` for production
