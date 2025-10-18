# TakeBack

Real-time confidential information protection for Google Meet using AI.

## Overview

TakeBack is an Electron-based desktop overlay that monitors your audio during Google Meet calls and prevents you from accidentally sharing confidential information. It uses OpenAI Whisper for speech-to-text and an LLM to analyze danger levels in real-time.

## Features

### Current (v0.1)
- **Overlay Interface**: Always-on-top, transparent overlay widget
- **Draggable Window**: Drag from the header to reposition
- **Real-time Danger Meter**: Visual indicator (0-100) of risk level
- **Live Transcription Display**: See what's being transcribed
- **Activity Log**: Track all monitoring events with timestamps
- **Configurable Settings**:
  - Sensitivity levels (1-5)
  - Custom confidential keywords
  - Auto-mute toggle
- **Demo Mode**: Simulated monitoring with sample phrases

### Planned
- [ ] Audio capture from system/microphone
- [ ] OpenAI Whisper integration for speech-to-text
- [ ] LLM integration for danger analysis
- [ ] System-level mute control
- [ ] Custom context/training for your confidential topics
- [ ] Browser extension mode for Google Meet

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

## Overlay Controls

- **Header**: Drag to move the overlay
- **Minimize Button**: Minimize to background
- **Close Button**: Close the application
- **Start/Stop**: Begin/end monitoring
- **Settings**: Click to expand/collapse settings panel

## Architecture

```
Audio Input
  ↓
Whisper (Speech-to-Text)
  ↓
LLM (Danger Analysis)
  ↓
Decision Engine
  ↓
Auto-Mute (if danger > threshold)
```

## Development

The app uses:
- **Electron**: Desktop overlay framework
- **Node.js**: Backend processing
- **Vanilla JS**: Frontend interactions
- **CSS3**: Modern UI with backdrop blur

### File Structure

```
TakeBack/
├── main.js           # Main Electron process
├── index.html        # Overlay UI structure
├── styles.css        # Overlay styling
├── renderer.js       # Frontend logic
└── package.json      # Dependencies
```

## Todo

- Integrate Whisper.cpp for fast local transcription
- Connect to OpenAI/Anthropic API for LLM analysis
- Implement actual audio capture
- Add system-level mute control for macOS
- Optimize for sub-second latency
- Add visual warning flash before auto-mute
- Post-meeting transcript export

## License

ISC
