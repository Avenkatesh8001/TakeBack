// ONNX-based Intent Detection for Predictive Muting
// Uses fine-tuned MiniLM model running locally in browser via onnxruntime-web
// Detects leak-intent BEFORE sensitive words are spoken

(function() {
  'use strict';

  // Import onnxruntime-web from CDN (fallback if npm install doesn't work)
  const ONNX_RUNTIME_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js';

  class IntentDetector {
    constructor() {
      this.session = null;
      this.vocab = null;
      this.tokenizerConfig = null;
      this.ready = false;
      this.loading = false;
      this.lastInferenceTime = 0;
      this.inferenceThrottle = 300; // Only run every 300ms
      this.ort = null; // ONNX Runtime
    }

    async initialize() {
      if (this.ready || this.loading) return;

      this.loading = true;
      console.log('[IntentDetector] Initializing ONNX Runtime...');

      try {
        // Load ONNX Runtime
        await this.loadONNXRuntime();

        // Configure for performance
        this.ort.env.wasm.numThreads = 2;
        this.ort.env.wasm.simd = true;

        // Load model files
        const modelUrl = chrome.runtime.getURL('models/intent_classifier.onnx');
        const vocabUrl = chrome.runtime.getURL('models/vocab.json');
        const configUrl = chrome.runtime.getURL('models/tokenizer_config.json');

        console.log('[IntentDetector] Loading model files...');

        // Load vocab and config in parallel
        const [vocabResponse, configResponse] = await Promise.all([
          fetch(vocabUrl),
          fetch(configUrl)
        ]);

        this.vocab = await vocabResponse.json();
        this.tokenizerConfig = await configResponse.json();

        // Create inference session
        console.log('[IntentDetector] Creating inference session...');
        this.session = await this.ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          enableCpuMemArena: true,
          enableMemPattern: true
        });

        this.ready = true;
        this.loading = false;

        const inputNames = this.session.inputNames;
        const outputNames = this.session.outputNames;

        console.log('[IntentDetector] ✓ Model loaded successfully');
        console.log('[IntentDetector]   Inputs:', inputNames);
        console.log('[IntentDetector]   Outputs:', outputNames);
        console.log('[IntentDetector]   Vocab size:', Object.keys(this.vocab).length);

      } catch (error) {
        console.error('[IntentDetector] Failed to load model:', error);
        this.loading = false;
        this.ready = false;
        throw error;
      }
    }

    async loadONNXRuntime() {
      // Try to use npm installed version first
      if (typeof window.ort !== 'undefined') {
        this.ort = window.ort;
        console.log('[IntentDetector] Using window.ort');
        return;
      }

      // Fallback to CDN
      console.log('[IntentDetector] Loading ONNX Runtime from CDN...');
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = ONNX_RUNTIME_CDN;
        script.onload = () => {
          this.ort = window.ort;
          console.log('[IntentDetector] ✓ ONNX Runtime loaded from CDN');
          resolve();
        };
        script.onerror = () => {
          reject(new Error('Failed to load ONNX Runtime from CDN'));
        };
        document.head.appendChild(script);
      });
    }

    // Simple tokenizer (compatible with MiniLM)
    tokenize(text) {
      if (!this.vocab || !this.tokenizerConfig) {
        throw new Error('Tokenizer not initialized');
      }

      const maxLength = this.tokenizerConfig.max_length || 32;
      const padTokenId = this.tokenizerConfig.pad_token_id || 0;
      const clsTokenId = this.tokenizerConfig.cls_token_id || 101;
      const sepTokenId = this.tokenizerConfig.sep_token_id || 102;
      const unkTokenId = this.tokenizerConfig.unk_token_id || 100;

      // Simple word-level tokenization
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0);

      // Convert words to token IDs
      const tokenIds = [clsTokenId];

      for (const word of words) {
        if (tokenIds.length >= maxLength - 1) break;

        // Look up token in vocab
        let tokenId = this.vocab[word];

        // Try subword tokenization if word not found
        if (tokenId === undefined) {
          tokenId = unkTokenId;
        }

        tokenIds.push(tokenId);
      }

      // Add SEP token
      tokenIds.push(sepTokenId);

      // Pad to maxLength
      const paddingLength = maxLength - tokenIds.length;
      const paddedTokenIds = [...tokenIds, ...Array(paddingLength).fill(padTokenId)];

      // Create attention mask (1 for real tokens, 0 for padding)
      const attentionMask = [
        ...Array(tokenIds.length).fill(1),
        ...Array(paddingLength).fill(0)
      ];

      return {
        input_ids: paddedTokenIds.slice(0, maxLength),
        attention_mask: attentionMask.slice(0, maxLength)
      };
    }

    // Run inference on text
    async predict(text) {
      if (!this.ready) {
        console.warn('[IntentDetector] Model not ready, skipping inference');
        return null;
      }

      // Throttle inference to avoid performance issues
      const now = Date.now();
      if (now - this.lastInferenceTime < this.inferenceThrottle) {
        return null; // Skip this inference
      }
      this.lastInferenceTime = now;

      try {
        const startTime = performance.now();

        // Tokenize input
        const { input_ids, attention_mask } = this.tokenize(text);

        // Create tensors (ONNX expects int64)
        const inputIdsTensor = new this.ort.Tensor(
          'int64',
          BigInt64Array.from(input_ids.map(BigInt)),
          [1, input_ids.length]
        );

        const attentionMaskTensor = new this.ort.Tensor(
          'int64',
          BigInt64Array.from(attention_mask.map(BigInt)),
          [1, attention_mask.length]
        );

        // Run inference
        const feeds = {
          input_ids: inputIdsTensor,
          attention_mask: attentionMaskTensor
        };

        const results = await this.session.run(feeds);

        // Extract logits
        const logitsData = results.logits.data;
        const safeLogit = logitsData[0];
        const leakLogit = logitsData[1];

        // Apply softmax
        const scores = this.softmax([safeLogit, leakLogit]);

        const latency = performance.now() - startTime;

        const result = {
          safe: scores[0],
          leak: scores[1],
          label: scores[1] > scores[0] ? 'LEAK_INTENT' : 'SAFE',
          confidence: Math.max(scores[0], scores[1]),
          latency: latency
        };

        console.log(
          `[IntentDetector] "${text.substring(0, 40)}..." → ${result.label} ` +
          `(${(result.confidence * 100).toFixed(1)}%) [${latency.toFixed(1)}ms]`
        );

        return result;

      } catch (error) {
        console.error('[IntentDetector] Inference error:', error);
        return null;
      }
    }

    // Softmax function
    softmax(logits) {
      const maxLogit = Math.max(...logits);
      const expValues = logits.map(l => Math.exp(l - maxLogit));
      const sumExp = expValues.reduce((a, b) => a + b);
      return expValues.map(e => e / sumExp);
    }

    // Check if should mute based on prediction
    shouldMute(prediction, threshold = 0.7) {
      if (!prediction) return false;
      return prediction.label === 'LEAK_INTENT' && prediction.confidence >= threshold;
    }

    // Get status for debugging
    getStatus() {
      return {
        ready: this.ready,
        loading: this.loading,
        vocabSize: this.vocab ? Object.keys(this.vocab).length : 0,
        modelLoaded: this.session !== null
      };
    }
  }

  // Export singleton instance
  window.IntentDetector = IntentDetector;

  // Create global instance
  window.intentDetector = new IntentDetector();

  // Auto-load model (async, non-blocking)
  window.intentDetector.initialize().then(() => {
    console.log('[IntentDetector] Ready for predictions');
  }).catch(err => {
    console.warn('[IntentDetector] Auto-load failed:', err);
    console.warn('[IntentDetector] Will fall back to keyword-only detection');
  });

  console.log('[IntentDetector] Module loaded');

})();
