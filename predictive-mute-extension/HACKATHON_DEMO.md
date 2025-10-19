# Predictive Mute - Hackathon Demo Guide

## Overview
A Chrome extension that prevents accidental disclosure of sensitive information in Google Meet/Zoom by detecting keywords BEFORE they're spoken using lookahead analysis.

## Quick Demo (5 minutes)

### Setup
1. Load extension in Chrome (`chrome://extensions` → Load unpacked)
2. Create PNG icons using `create-png-icons.html`
3. Open Google Meet test page

### Demo Script

**Scene 1: Show the Problem**
> "Imagine you're in a customer demo and accidentally about to say your database password..."

**Scene 2: Show the Solution**
1. Open extension popup - show settings
   - Lookahead: 2 words
   - Keywords: password, credit card, secret
2. Go to Google Meet tab
3. Show green indicator: "🛡️ Predictive Mute Active"
4. Click in chat input field

**Scene 3: Live Demo**
Type and press Enter:
```
"I will now share my password hunter2"
```

**Expected Result:**
- 🔇 Red alert appears: "MUTED BEFORE SENSITIVE WORD"
- Shows: "Detected: password (1 word ahead)"
- Extension badge turns red with "!"

**Scene 4: Show it Doesn't Over-trigger**
Type and press Enter:
```
"Let's review the quarterly report and roadmap"
```

**Expected Result:**
- ✅ No alert
- Logs show: "No sensitive content detected"

**Scene 5: Show Customization**
1. Open extension popup
2. Add custom keyword: "project falcon" (your secret codename)
3. Set lookahead to 3 words
4. Save settings

Test again:
```
"The details about project falcon are ready"
```

**Expected Result:**
- 🔇 Alert triggered on "project" or "falcon"

## Key Selling Points

### 1. Predictive (Not Reactive)
- Catches keywords BEFORE they're spoken
- Configurable lookahead window (1-10 words)
- Prevents the leak rather than reacting to it

### 2. Privacy-First
- 100% local processing
- No data sent to servers
- All detection happens in browser

### 3. Zero Latency
- Instant keyword matching
- Real-time analysis
- No API calls needed for detection

### 4. Customizable
- User-defined keywords
- Adjustable sensitivity (lookahead)
- Per-project configurations

## Technical Highlights

### Architecture
```
Content Script → Keyboard Monitor → Lookahead Analyzer → Mute Trigger
      ↓               ↓                    ↓                   ↓
  Input Field    Word Array          Keyword Match      Visual Alert
                                                        + Badge Update
```

### Key Algorithm (content.js:87-106)
```javascript
function shouldMute(words, startIndex, lookaheadWindow) {
  const endIndex = Math.min(words.length, startIndex + lookaheadWindow);

  for (let i = startIndex; i < endIndex; i++) {
    const normalizedWord = normalize(words[i]);

    for (const sensitiveWord of config.sensitiveWords) {
      if (normalizedWord.includes(normalize(sensitiveWord))) {
        return {
          mute: true,
          triggerWord: words[i],
          wordsAhead: i - startIndex
        };
      }
    }
  }
  return { mute: false };
}
```

### Manifest V3 Benefits
- Service worker for better performance
- Declarative permissions
- Modern Chrome extension architecture

## Future Enhancements (Show Roadmap)

### Phase 1: Real-time Speech (Next Sprint)
- Web Speech API integration
- Live microphone capture
- Actual WebRTC muting

### Phase 2: AI-Powered Detection
- LLM semantic analysis
- Context-aware detection
- False positive reduction

### Phase 3: Team Features
- Shared keyword policies
- Organization-wide settings
- Compliance reporting

### Phase 4: Multi-Platform
- Zoom native client
- Microsoft Teams
- Slack Huddles
- Discord

## Demo Tips

### If Something Goes Wrong

**Extension doesn't load:**
- Show them the fallback: manually created icons
- Explain that PNGs are required by Chrome

**Detection doesn't trigger:**
- Open DevTools (F12) → Show console logs
- Demonstrate that it's actively monitoring
- Show the word-by-word processing logs

**No visual indicator:**
- Refresh the tab
- Show it's a permission issue (rare)
- Click extension icon to toggle

### Questions You'll Get

**Q: "Does it work with live speech?"**
A: "Currently demo mode with typed input. Production version will use Web Speech API or Whisper for real-time audio transcription. Here's the architecture..." [Show README Future Enhancements]

**Q: "What about false positives?"**
A: "That's why we have the lookahead window - you can tune it. Also planning LLM integration for semantic understanding. For example, 'password-protected document' wouldn't trigger if we add context analysis."

**Q: "How fast is it?"**
A: "Instant - keyword matching is O(n*m) where n=lookahead, m=keywords. For 5 keywords and 2-word lookahead, that's 10 comparisons per word. Sub-millisecond."

**Q: "Can attackers bypass it?"**
A: "It's a safety net, not security through obscurity. The value is preventing *accidental* disclosure. Intentional leaks require policy enforcement at a different layer."

**Q: "How does it handle multiple languages?"**
A: "Current version is English-only, but the algorithm is language-agnostic. You can add keywords in any language. For production, we'd add language detection and localized keyword libraries."

## Success Metrics for Demo

✅ Attendees understand the problem (accidental disclosure)
✅ Visual demo works without technical issues
✅ At least one "wow" moment (seeing the mute trigger)
✅ Questions about production deployment
✅ Interest in testing/contributing

## Follow-up Materials

After demo, share:
1. **GitHub repo**: Full source code
2. **Installation guide**: `INSTALL.md`
3. **Technical docs**: `README.md`
4. **Roadmap**: Link to issues/project board
5. **Contact**: Email/Discord for beta testing

## Pre-Demo Checklist

- [ ] Test in fresh Chrome profile
- [ ] Verify all 3 test cases work
- [ ] Have DevTools open in separate monitor
- [ ] Prepare backup demo video (if live demo fails)
- [ ] Test on actual Google Meet call (not just the page)
- [ ] Clear extension logs before starting
- [ ] Set lookahead to 2 (optimal for demo)
- [ ] Have browser zoom at 100% (for projector)

## Elevator Pitch (30 seconds)

*"Predictive Mute is a Chrome extension that prevents accidental disclosure of sensitive information during video calls. Unlike traditional keyword filters that react after you've spoken, we use lookahead analysis to detect sensitive content BEFORE it's said and automatically mute your mic. Perfect for customer demos, investor calls, or any meeting where a slip could be costly. It's privacy-first—everything runs locally in your browser—and fully customizable to your organization's sensitive keywords."*

## Contact

Questions? Issues? Want to contribute?
- GitHub: [Add your repo URL]
- Email: [Add contact]
- Demo: [Add live demo link if hosted]

---

**Remember**: This is a demo showing the CONCEPT. Emphasize the vision and roadmap, not current limitations. The hackathon judges care about innovation and potential, not production-ready code.

Good luck! 🚀
