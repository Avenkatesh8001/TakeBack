# 🧪 LEARNING MODEL TEST GUIDE

## How to Verify the Learning Model is Actually Working

Follow these steps to test if the extension is actually learning from your feedback:

---

## ✅ Step-by-Step Test

### 1. **Setup**
1. Reload the extension: `chrome://extensions` → reload button
2. Go to Google Meet: https://meet.google.com
3. Open the extension popup in a separate window (right-click icon → "Open in new window")
4. Enable audio monitoring in popup
5. Enable learning model (checkbox should be ON by default)
6. Check initial learning stats: Should show `📊 Stats: 0 corrections | ✓ 0 confirmed | ✗ 0 ignored`

---

### 2. **Test False Positive Learning** (Most Important!)

#### A. Trigger a False Positive
1. In the meeting tab, say a word that triggers muting (e.g., "password")
2. Alert should appear: "🔇 MICROPHONE MUTED"
3. Alert should have TWO buttons:
   - `✓ Correct` (green button)
   - `✗ Wrong` (red button)

#### B. Mark as Wrong (False Positive)
1. Click the **✗ Wrong** button
2. You should see a confirmation message: "✗ Noted! Won't mute this again"
3. Open browser console (F12) and look for:
   ```
   [PredictiveMute] Learning: Added false positive: password
   ```

#### C. Verify Learning Applied
1. Say "password" again
2. **Expected Result**: Should NOT mute this time!
3. Check console for:
   ```
   [PredictiveMute] Skipping false positive from learning: password
   ```

#### D. Check Stats Updated
1. Open popup
2. Learning stats should now show: `📊 Stats: 1 corrections | ✓ 0 confirmed | ✗ 1 ignored`

---

### 3. **Test True Positive Learning**

#### A. Mark a Detection as Correct
1. Say another sensitive word (e.g., "confidential")
2. Alert appears
3. Click **✓ Correct** button
4. Confirmation: "✓ Thank you! Learning improved"

#### B. Check Stats
1. Open popup
2. Stats should show: `📊 Stats: 2 corrections | ✓ 1 confirmed | ✗ 1 ignored`

---

### 4. **Test Persistence** (Verify Data is Saved)

#### A. Check Storage
1. Open browser console (F12)
2. Go to "Application" tab → "Storage" → "Extension Storage" → "Local"
3. Find the extension and check for `learningData`
4. Should see:
   ```json
   {
     "falsePositives": ["password"],
     "truePositives": ["confidential"],
     "corrections": 2
   }
   ```

#### B. Test Across Reload
1. Reload the extension completely
2. Go back to Google Meet
3. Say "password" again
4. **Expected**: Should still NOT mute (learning persisted!)

---

### 5. **Test Learning Override**

If a word is in the false positives list, it should NEVER mute, even if it matches other rules.

1. Add "fuck" to the sensitive words list (in popup settings)
2. Say "fuck" - it should mute
3. Click **✗ Wrong** button
4. Say "fuck" again
5. **Expected**: Should NOT mute anymore (learning overrides curse word detection)

---

## 🔍 Debug Checklist

If learning doesn't seem to be working, check these:

### Check 1: Learning Enabled
- Open popup
- Verify "Enable Learning Model" checkbox is **CHECKED**
- If unchecked, learning is disabled

### Check 2: Buttons Appearing
- When muted, alert should show TWO buttons
- If no buttons appear, learning may be disabled or there's a config issue
- Check console for errors

### Check 3: Console Logs
Open browser console (F12) and look for these messages:

**When clicking ✗ Wrong:**
```
[PredictiveMute] Learning: Added false positive: [word]
```

**When word is skipped:**
```
[PredictiveMute] Skipping false positive from learning: [word]
```

**When clicking ✓ Correct:**
```
[PredictiveMute] Learning: Added true positive: [word]
```

### Check 4: Storage Inspection
1. F12 → Application tab → Extension Storage → Local
2. Find extension ID
3. Check `learningData` key exists
4. Verify arrays are populating

### Check 5: Stats Updating
- Open popup
- Stats line should update each time you click ✓ or ✗
- If stats stay at 0, learning data is not saving

---

## 🐛 Common Issues

### Issue 1: "Buttons not appearing"
**Cause**: Learning disabled in config
**Fix**: Open popup → Check "Enable Learning Model" → Save Settings

### Issue 2: "Stats not updating"
**Cause**: Storage not saving
**Fix**:
1. Check browser console for storage errors
2. Reload extension
3. Try again

### Issue 3: "Word still mutes after marking as wrong"
**Cause**: Word normalization mismatch
**Fix**:
1. Check console logs to see normalized form
2. The word is normalized (lowercased, special chars removed)
3. If you said "Password!" it's stored as "password"

### Issue 4: "Learning doesn't persist after reload"
**Cause**: Data not saving to chrome.storage.local
**Fix**:
1. Check Application → Storage for learningData
2. If empty, there's a storage permission issue
3. Verify manifest.json has "storage" permission

---

## ✅ Expected Behavior

### Scenario A: Word Marked as False Positive
```
1. Say "password" → MUTES
2. Click ✗ Wrong
3. Say "password" → DOES NOT MUTE ✓
4. Stats: corrections +1, ignored +1
```

### Scenario B: Word Marked as True Positive
```
1. Say "custom-word" (not in keywords) → does not mute
2. Manually add to keywords, say it → MUTES
3. Click ✓ Correct
4. Stats: corrections +1, confirmed +1
5. Word is now permanently in learned true positives
```

### Scenario C: Learning Overrides Built-in Rules
```
1. Say "shit" (curse word) → MUTES
2. Click ✗ Wrong
3. Say "shit" → DOES NOT MUTE ✓
4. Learning overrides curse word detection
```

---

## 📊 Verify Learning is Actually Working

Here's a simple 2-minute test:

1. ✅ Say "password" → mutes
2. ✅ Click ✗ Wrong
3. ✅ See confirmation "Won't mute this again"
4. ✅ Say "password" again → **DOES NOT MUTE** ← THIS PROVES IT'S LEARNING!
5. ✅ Check popup stats → Shows 1 correction, 1 ignored

If step 4 still mutes, the learning is NOT working.
If step 4 does NOT mute, the learning IS working! ✅

---

## 🎯 What Learning Does

### False Positives (✗ Wrong)
- Adds word to `learningData.falsePositives` array
- Word is checked FIRST before any other detection
- If match found in false positives → **SKIP** detection
- Overrides ALL rules (sensitive words, curse words, topics)

### True Positives (✓ Correct)
- Adds word to `learningData.truePositives` array
- Word is checked right after false positives
- If match found in true positives → **MUTE IMMEDIATELY**
- Confirms the detection was correct

### Corrections Counter
- Increments every time you click ✓ or ✗
- Shows total number of feedback events
- Displayed in popup stats

---

## 🔬 Advanced Verification

### Test Learning Data Direct Manipulation

Open browser console and run:

```javascript
// Get current learning data
chrome.storage.local.get(['learningData'], (data) => {
  console.log('Learning Data:', data.learningData);
});

// Manually add a false positive
chrome.storage.local.get(['learningData'], (data) => {
  const learningData = data.learningData || { falsePositives: [], truePositives: [], corrections: 0 };
  learningData.falsePositives.push('testword');
  learningData.corrections++;
  chrome.storage.local.set({ learningData }, () => {
    console.log('Added testword to false positives');
  });
});

// Verify it was saved
chrome.storage.local.get(['learningData'], (data) => {
  console.log('Updated Learning Data:', data.learningData);
});
```

Then say "testword" - it should NOT mute!

---

## ✅ Final Confirmation

**The learning model IS working if:**
- ✅ Buttons appear on alerts
- ✅ Stats update when clicking buttons
- ✅ Console shows "Added false/true positive" messages
- ✅ Words marked as wrong don't trigger mutes anymore
- ✅ Learning persists after extension reload
- ✅ Storage shows learningData with arrays populated

**The learning model is NOT working if:**
- ❌ No buttons on alerts
- ❌ Stats stay at 0 corrections
- ❌ Words marked as wrong still trigger mutes
- ❌ No console logs about learning
- ❌ Storage shows empty/missing learningData

---

## 📝 Quick Answer: "Is it actually learning?"

**YES, it IS learning!**

The code implementation includes:
1. ✅ Storage persistence (`chrome.storage.local.set({ learningData })`)
2. ✅ False positive checking (line 483-486)
3. ✅ True positive checking (line 489-498)
4. ✅ Feedback buttons on alerts (line 791-796)
5. ✅ Event handlers for buttons (line 841-852)
6. ✅ Data saving on feedback (line 887)
7. ✅ Stats tracking in popup (line 66-74)

**To VERIFY it's learning:**
Just say a sensitive word → click ✗ Wrong → say it again → it should NOT mute!

If it still mutes after clicking ✗ Wrong, there's a bug. But based on the code, it SHOULD work correctly.

---

**Created**: 2025-10-18
**Purpose**: Verify learning model functionality
