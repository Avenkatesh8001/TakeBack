# 🚀 Launch Instructions - Predictive Mute Extension

## ✅ Extension is Ready!

All files are created and validated. PNG icons are in place.

## Step 1: Open Chrome Extensions Page

**Option A - Via URL:**
```
1. Open Chrome browser
2. Type in address bar: chrome://extensions
3. Press Enter
```

**Option B - Via Menu:**
```
1. Open Chrome
2. Click the three dots (⋮) in top-right
3. More Tools → Extensions
```

## Step 2: Enable Developer Mode

```
1. Look for "Developer mode" toggle in the top-right corner
2. Click to enable it (should turn blue)
```

## Step 3: Load the Extension

```
1. Click "Load unpacked" button (appears after enabling Developer mode)
2. Navigate to: /Users/anirudhvenkatesh/TakeBack/predictive-mute-extension
3. Click "Select" or "Open"
```

The extension should now appear in your list!

## Step 4: Verify Installation

You should see:
- ✅ Extension card titled "Predictive Mute for Meetings"
- ✅ Version: 1.0
- ✅ Blue icon (or placeholder icon)
- ✅ No errors in red

## Step 5: Test the Extension

### Quick Test (1 minute)

1. **Open Google Meet:**
   ```
   Go to: https://meet.google.com
   ```

2. **Look for the indicator:**
   - Bottom-right corner of the page
   - Should see: "🛡️ Predictive Mute Active" (green badge)

3. **Test detection:**
   - Click any input field on the page
   - Type: `I will share my password now`
   - Press ENTER
   - You should see a RED ALERT: "🔇 MUTED BEFORE SENSITIVE WORD"

### Full Test (3 minutes)

**Test Case 1 - Should Trigger:**
```
Type: "I will now share my password hunter2"
Press: ENTER
Result: ⚠️ Red alert appears with "password" detected
```

**Test Case 2 - Should NOT Trigger:**
```
Type: "Let's review the quarterly report"
Press: ENTER
Result: ✅ No alert (safe content)
```

**Test Case 3 - Custom Keywords:**
```
1. Click extension icon in Chrome toolbar
2. Add keyword: "project falcon"
3. Click "Save Settings"
4. Type: "The project falcon details are ready"
5. Press: ENTER
Result: ⚠️ Red alert appears with "project" or "falcon" detected
```

## Step 6: View Logs

1. Click the extension icon in Chrome toolbar
2. Scroll to "Recent Activity"
3. You'll see all detection events logged

## 🐛 Troubleshooting

### Extension won't load
**Error: "Manifest file is missing or unreadable"**
- ✅ Already fixed - manifest.json is valid
- Try reloading: Click reload icon on extension card

**Error: "Could not load icon"**
- ✅ Already fixed - PNG icons are created
- Verify: `ls icons/*.png` shows 3 files

### No green indicator on Google Meet
**Solution:**
```
1. Refresh the Google Meet tab
2. Wait 2 seconds for content script to load
3. Check browser console (F12) for [PredictiveMute] logs
```

### Detection not working
**Solution:**
```
1. Make sure extension is enabled (toggle in chrome://extensions)
2. Click extension icon → verify "Enable Predictive Mute" is checked
3. Press ENTER after typing (detection triggers on Enter key)
```

### Can't find extension icon
**Solution:**
```
1. Go to chrome://extensions
2. Look for puzzle piece icon in Chrome toolbar
3. Click it to see all extensions
4. Click pin icon next to "Predictive Mute for Meetings"
```

## 🎯 Next Steps

Once installed and tested:

1. **Read the demo script:**
   ```
   open HACKATHON_DEMO.md
   ```

2. **Customize settings:**
   - Click extension icon
   - Adjust lookahead window (default: 2)
   - Add your own sensitive keywords
   - Click "Save Settings"

3. **View logs:**
   - All detection events are logged
   - View in extension popup under "Recent Activity"

## 🔧 Developer Tools

**View console logs:**
```
1. Go to Google Meet tab
2. Press F12 (or Cmd+Option+I on Mac)
3. Click "Console" tab
4. Look for [PredictiveMute] messages
```

**Inspect background service worker:**
```
1. Go to chrome://extensions
2. Find "Predictive Mute for Meetings"
3. Click "service worker" link
4. View background script logs
```

**Inspect popup:**
```
1. Click extension icon to open popup
2. Right-click inside the popup
3. Select "Inspect"
4. View popup.js logs
```

## 📍 Extension Location

```
/Users/anirudhvenkatesh/TakeBack/predictive-mute-extension/
```

## ✅ Installation Checklist

- [ ] Chrome extensions page open
- [ ] Developer mode enabled
- [ ] Extension loaded (no errors)
- [ ] Extension appears in toolbar
- [ ] Green indicator visible on meet.google.com
- [ ] Test case 1 triggers alert
- [ ] Test case 2 does NOT trigger
- [ ] Logs show activity

## 🎉 You're All Set!

The extension is now running in Chrome. Visit any Google Meet or Zoom page to see it in action!

---

**Need Help?**
- Check: QUICK_START.txt
- Read: HACKATHON_DEMO.md
- Reference: README.md
