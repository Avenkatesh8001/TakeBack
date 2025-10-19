// ONNX-based Intent Detection for Predictive Muting
// Uses fine-tuned DeBERTa model running locally in browser via onnxruntime-web
// Detects PII leak-intent BEFORE sensitive words are spoken

(function() {
  'use strict';

  // Import onnxruntime-web and transformers.js from CDN
  const ONNX_RUNTIME_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js';
  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.11.0';

  class IntentDetector {
    constructor() {
      this.session = null;
      this.tokenizer = null;
      this.ready = false;
      this.loading = false;
      this.lastInferenceTime = 0;
      this.inferenceThrottle = 300; // Only run every 300ms
      this.ort = null; // ONNX Runtime
    }

    async initialize() {
      if (this.ready || this.loading) return;

      this.loading = true;
      console.log('[IntentDetector] Initializing ONNX Runtime and Transformers.js...');

      try {
        // Load ONNX Runtime and Transformers.js in parallel
        await Promise.all([
          this.loadScript('onnxruntime', ONNX_RUNTIME_CDN),
          this.loadScript('transformers', TRANSFORMERS_CDN)
        ]);

        this.ort = window.ort;
        const { AutoTokenizer } = window.Transformers;

        // Configure ONNX Runtime for performance
        this.ort.env.wasm.numThreads = 2;
        this.ort.env.wasm.simd = true;

        // Load model and tokenizer files
        const modelUrl = 'https://huggingface.co/pavidu/piiranha-v1-detect-personal-information-onnx/resolve/main/model.onnx';
        const tokenizerUrl = 'iiiorg/piiranha-v1-detect-personal-information';

        console.log('[IntentDetector] Loading model and tokenizer...');

        // Load tokenizer and create inference session in parallel
        const [tokenizer, session] = await Promise.all([
          AutoTokenizer.from_pretrained(tokenizerUrl),
          this.ort.InferenceSession.create(modelUrl, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            enableCpuMemArena: true,
            enableMemPattern: true
          })
        ]);

        this.tokenizer = tokenizer;
        this.session = session;
        this.ready = true;
        this.loading = false;

        const inputNames = this.session.inputNames;
        const outputNames = this.session.outputNames;

        console.log('[IntentDetector] ✓ Model loaded successfully');
        console.log('[IntentDetector]   Inputs:', inputNames);
        console.log('[IntentDetector]   Outputs:', outputNames);
        console.log('[IntentDetector]   Tokenizer:', tokenizer.constructor.name);

      } catch (error) {
        console.error('[IntentDetector] Failed to load model:', error);
        this.loading = false;
        this.ready = false;
        throw error;
      }
    }

    async loadScript(id, src) {
      return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Tokenizer using transformers.js
    async tokenize(text) {
        if (!this.tokenizer) {
            throw new Error('Tokenizer not initialized');
        }
        return this.tokenizer(text, {
            padding: 'max_length',
            truncation: true,
            max_length: 256,
            return_tensors: 'ort'
        });
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
        const model_inputs = await this.tokenize(text);

        // Run inference
        const results = await this.session.run(model_inputs);
        const logits = results.logits;
        
        const predictions = [];
        for (let i = 0; i < logits.dims[1]; ++i) {
            const tokenLogits = Array.from(logits.data.slice(i * logits.dims[2], (i + 1) * logits.dims[2]));
            const labelIndex = tokenLogits.indexOf(Math.max(...tokenLogits));
            predictions.push(this.tokenizer.model.config.id2label[labelIndex]);
        }

        const latency = performance.now() - startTime;

        const hasPII = predictions.some(p => p !== 'O');
        const result = {
          hasPII: hasPII,
          predictions: predictions,
          latency: latency,
          label: hasPII ? 'LEAK_INTENT' : 'SAFE',
          leak: hasPII ? 1 : 0,
        };

        console.log(
          `[IntentDetector] "${text.substring(0, 40)}..." → ${result.label} ` +
          `(${(result.leak * 100).toFixed(1)}%) [${latency.toFixed(1)}ms]`
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
      return prediction.label === 'LEAK_INTENT';
    }

    // Get status for debugging
    getStatus() {
      return {
        ready: this.ready,
        loading: this.loading,
        modelLoaded: this.session !== null,
        tokenizerLoaded: this.tokenizer !== null
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