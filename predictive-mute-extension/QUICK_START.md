# Quick Start Guide - ONNX Predictive Mute

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies (One-Time Setup)

```bash
cd predictive-mute-extension

# Install JavaScript dependencies
npm install

# Install Python dependencies
cd ml-training
pip install transformers datasets torch optimum onnx onnxruntime
cd ..
```

### 2. Train & Convert Model

```bash
# Train the intent model (takes ~5-10 minutes)
npm run train-model

# Convert to ONNX format
npm run convert-model
```

**Expected output:**
```
✓ Model saved to: ./fine-tuned-intent-model
✓ ONNX model exported: ./onnx-models/model_quantized.onnx
✓ Copied to: ../models/intent_classifier.onnx
✓ Ready for browser deployment!
```

### 3. Load Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select `predictive-mute-extension` folder
5. ✅ Done!

### 4. Test It

1. Join a Google Meet: https://meet.google.com/
2. Start a new meeting
3. Look for the extension icon (bottom-right, pulsing green)
4. Try saying these phrases:

**Should MUTE:**
- "let me tell you my password"
- "my social security number is"
- "I'll share my credit card"
- "the API key is"

**Should NOT mute:**
- "let me tell you about my day"
- "I think we should discuss this"
- "can you hear me okay"

5. Click Yes/No on feedback prompts to improve accuracy

---

## 📊 Check Status

Open browser console (F12) during a call:

```javascript
// Check ONNX model status
window.intentDetector.getStatus()
// → { ready: true, vocabSize: 30522, modelLoaded: true }

// Check feedback stats
window.feedbackCollector.getStats()
// → { totalSamples: 23, accuracy: '91.3%', falsePositives: 2 }

// Test prediction manually
await window.intentDetector.predict("let me share my password")
// → { leak: 0.94, label: 'LEAK_INTENT', confidence: 0.94, latency: 67 }
```

---

## ⚙️ Common Adjustments

### Make Detection More Aggressive

Edit `ml-classifier.js` line 219:
```javascript
if (intentResult.confidence >= 0.5) {  // was 0.7
```

### Make Detection Less Sensitive

```javascript
if (intentResult.confidence >= 0.9) {  // was 0.7
```

### Speed Up Inference

Edit `intent-detector.js` line 29:
```javascript
this.inferenceThrottle = 200;  // was 300ms
```

---

## 🔄 Export Feedback & Retrain

After using for a week:

```javascript
// In console:
window.feedbackCollector.exportDataset()
// Downloads: predictive-mute-training-data-<timestamp>.csv
```

Then:
```bash
# Add feedback data to training
# Edit ml-training/train_intent_model.py and import the CSV

# Retrain
npm run train-model
npm run convert-model

# Reload extension
```

---

## 🐛 Troubleshooting

### "Model not loading"
- Check that `models/` folder has 3 files:
  - `intent_classifier.onnx`
  - `vocab.json`
  - `tokenizer_config.json`
- Run `npm run convert-model` again

### "High CPU usage"
- Increase throttle: `inferenceThrottle = 500` (ms)
- Close other tabs

### "Too many false positives"
- Increase threshold to 0.8 or 0.9
- Collect more feedback and retrain

---

## 📁 What Gets Created

```
predictive-mute-extension/
├── models/                       # Auto-created by convert script
│   ├── intent_classifier.onnx    # 20MB ONNX model
│   ├── vocab.json                # Tokenizer vocabulary
│   └── tokenizer_config.json     # Tokenizer settings
├── ml-training/
│   ├── fine-tuned-intent-model/  # PyTorch checkpoint
│   └── onnx-models/              # ONNX intermediate files
└── node_modules/                 # npm dependencies
```

---

## ✅ Success Checklist

- [ ] npm install completed
- [ ] Python dependencies installed
- [ ] Training completed (accuracy >90%)
- [ ] ONNX conversion successful
- [ ] Extension loaded in Chrome
- [ ] Icon visible on Google Meet
- [ ] Test phrases trigger mute correctly
- [ ] Console shows "IntentDetector ready"
- [ ] Feedback buttons working

---

## 🎯 Next Steps

1. Use for 1 week → Collect 50+ feedback samples
2. Export feedback → Retrain model
3. Fine-tune thresholds based on your usage
4. Share your trained model with team!

---

## 📚 Full Documentation

See `README_ML_SETUP.md` for:
- Architecture details
- Advanced training options
- API reference
- Performance benchmarks
- Custom model training
