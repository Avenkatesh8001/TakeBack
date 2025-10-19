// Predictive Mute - Clean, Fast, Working Version
// Detects sensitive words BEFORE they're spoken to the meeting
//main content file
(function() {
  'use strict';

  console.log('[PredictiveMute] Starting...');

  // CONFIG
  let config = {
    enabled: true,
    sensitiveWords: ["password", "credit", "card", "confidential", "secret", "ssn", "social security", "bank", "account", "routing", "salary", "compensation", "bonus", "stock", "fuck", "shit", "damn", "bitch", "asshole", "cunt", "motherfucker"],
    bannedTopics: [],
    learningEnabled: true,
    confidenceThreshold: 0.7
  };

  // STATE
  let recognition = null;
  let isListening = false;
  let isMuted = false;
  let isRecovering = false;
  let lastMuteTime = 0;
  let logs = [];
  const MUTE_COOLDOWN = 2000;
  const RECOVERY_TIME = 2000; // 2 seconds after unmute
  const MAX_LOGS = 50;

  // ULTRA-FAST DETECTION STATE
  let partialTranscript = ''; // Accumulates partial results for instant checking
  let lastCheckTime = 0;
  const MIN_CHECK_INTERVAL = 30; // Check every 30ms for ultra-fast response

  // ML INFERENCE STATE
  let lastMLInference = 0;
  const ML_INFERENCE_INTERVAL = 300; // Run ML every 300ms (balance speed vs compute)
  let currentConfidence = 0; // 0-100 confidence level
  let lastMLPrediction = null;

  // WHITELIST - never mute these
  const SAFE_WORDS = ['hello', 'hi', 'hey', 'okay', 'ok', 'thanks', 'thank', 'please', 'yes', 'no', 'sure', 'great', 'good', 'bye'];

  // PRECOMPUTED PREFIX MAP for O(1) lookup speed
  let sensitiveWordPrefixMap = new Map(); // Maps prefixes to full words

  function buildPrefixMap() {
    sensitiveWordPrefixMap.clear();
    for (const word of config.sensitiveWords) {
      const lower = word.toLowerCase();
      const prefixLength = lower.length <= 4 ? 2 : 3;
      const prefix = lower.substring(0, prefixLength);

      if (!sensitiveWordPrefixMap.has(prefix)) {
        sensitiveWordPrefixMap.set(prefix, []);
      }
      sensitiveWordPrefixMap.get(prefix).push(lower);
    }
    console.log(`[PredictiveMute] Built prefix map with ${sensitiveWordPrefixMap.size} prefixes`);
  }

  // Learning data
  let learningData = {
    falsePositives: [],
    truePositives: [],
    corrections: 0
  };

  // ============================================================================
  // INIT
  // ============================================================================

  function init() {
    chrome.storage.sync.get(['enabled', 'sensitiveWords', 'bannedTopics', 'learningEnabled', 'confidenceThreshold'], (data) => {
      if (data.enabled !== undefined) config.enabled = data.enabled;
      if (data.sensitiveWords) config.sensitiveWords = data.sensitiveWords;
      if (data.bannedTopics) config.bannedTopics = data.bannedTopics;
      if (data.learningEnabled !== undefined) config.learningEnabled = data.learningEnabled;
      if (data.confidenceThreshold) config.confidenceThreshold = data.confidenceThreshold;

      console.log('[PredictiveMute] Config:', config);

      // Build prefix map for ultra-fast detection
      buildPrefixMap();

      if (config.enabled) {
        startMonitoring();
      }
    });

    chrome.storage.local.get(['learningData', 'logs'], (data) => {
      if (data.learningData) learningData = data.learningData;
      if (data.logs) logs = data.logs;
    });

    setupListeners();
    injectStatusIndicator();
  }

  function setupListeners() {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === 'SETTINGS_UPDATED') {
        config = { ...config, ...request.settings };
        console.log('[PredictiveMute] Settings updated');

        // Rebuild prefix map when settings change
        buildPrefixMap();

        if (config.enabled && !isListening) {
          startMonitoring();
        } else if (!config.enabled) {
          stopMonitoring();
        }
      }
    });
  }

  // ============================================================================
  // AUDIO MONITORING - FAST & INSTANT
  // ============================================================================

  function startMonitoring() {
    if (isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[PredictiveMute] Speech Recognition not supported');
      addLog('Browser does not support speech recognition', true);
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // CRITICAL - for instant detection
    recognition.maxAlternatives = 1; // Only need the best guess for speed
    recognition.lang = 'en-US';

    // ULTRA-FAST MODE: These settings optimize for speed over accuracy
    // The browser will return partial results as fast as possible
    if (recognition.interimResults === undefined) {
      console.warn('[PredictiveMute] interimResults not supported - detection will be slower');
    }

    recognition.onstart = () => {
      console.log('[PredictiveMute] Monitoring started');
      isListening = true;
      updateStatus('listening');
      addLog('Monitoring started', false);
    };

    recognition.onresult = (event) => {
      const now = Date.now();

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const transcript = (finalTranscript + interimTranscript).toLowerCase().trim();

      if (transcript.length === 0 || now - lastCheckTime < MIN_CHECK_INTERVAL) {
        return;
      }

      lastCheckTime = now;
      partialTranscript = transcript;

      const confidence = event.results[event.results.length - 1][0].confidence || 1.0;
      const isFinal = event.results[event.results.length - 1].isFinal;

      checkAndMuteFast(transcript, confidence, isFinal);
    };

    recognition.onerror = (event) => {
      console.error('[PredictiveMute] Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        addLog('Microphone permission denied', true);
      }
    };

    recognition.onend = () => {
      console.log('[PredictiveMute] Recognition service ended.');
      // Always restart unless the user has explicitly disabled the extension.
      if (isListening && config.enabled) {
        console.log('[PredictiveMute] Service ended, attempting to restart...');
        try {
          // A short delay can help prevent rapid-fire restart errors
          setTimeout(() => recognition.start(), 100);
        } catch (e) {
          console.error('[PredictiveMute] Restart failed:', e);
        }
      } else {
        console.log('[PredictiveMute] Service stopped intentionally.');
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('[PredictiveMute] Failed to start:', err);
      addLog('Failed to start monitoring', true);
    }
  }

  function stopMonitoring() {
    isListening = false; // Set intent to stop first
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
    updateStatus('idle');
    console.log('[PredictiveMute] Monitoring stopped');
  }

  // ============================================================================
  // ULTRA-FAST DETECTION - SUB-200MS REACTION TIME
  // ============================================================================

  function checkAndMuteFast(text, confidence, isFinal) {
    // Skip if already muted or recovering
    if (isMuted || isRecovering) return;

    // Skip if in cooldown
    const now = Date.now();
    if (now - lastMuteTime < MUTE_COOLDOWN) return;

    // OPTIMIZATION 1: Early exit for common safe patterns
    if (text.length < 3) return; // Too short to be dangerous

    // Quick whitelist check - optimized with Set for O(1) lookup
    const words = text.split(/\s+/);
    if (words.length === 1 && SAFE_WORDS.includes(words[0])) return;

    // Filter learned false positives
    if (learningData.falsePositives.some(fp => text.includes(fp.toLowerCase()))) {
      return;
    }

    const textLower = text.toLowerCase();
    const detectionStartTime = Date.now();

    // OPTIMIZATION 2: Combined keyword and prefix search
    for (const sensitiveWord of config.sensitiveWords) {
      const lowerSensitiveWord = sensitiveWord.toLowerCase();

      // Skip if temporarily ignored
      if (window.tempIgnoredWords && window.tempIgnoredWords.includes(lowerSensitiveWord)) {
        continue;
      }

      // Full phrase match
      if (textLower.includes(lowerSensitiveWord)) {
        const reactionTime = Date.now() - detectionStartTime;
        console.log(`[PredictiveMute] ⚡ PHRASE DETECTED: "${text}" contains "${lowerSensitiveWord}" (${reactionTime}ms)`);
        updateConfidenceBar(100, 'LEAK_INTENT');
        executeInstantMute(lowerSensitiveWord, text, 'keyword');
        return;
      }

      // Prefix match
      const prefixLength = lowerSensitiveWord.length <= 4 ? 2 : 3;
      const prefix = lowerSensitiveWord.substring(0, prefixLength);
      for (const word of words) {
        if (word.length >= prefixLength && word.startsWith(prefix)) {
          const reactionTime = Date.now() - detectionStartTime;
          console.log(`[PredictiveMute] ⚡ PREFIX MATCH: "${word}" → "${lowerSensitiveWord}" (${reactionTime}ms)`);
          updateConfidenceBar(100, 'LEAK_INTENT');
          executeInstantMute(lowerSensitiveWord, text, 'keyword');
          return;
        }
      }
    }

    // OPTIMIZATION 3: Banned topics with fast word-set matching
    for (const topic of config.bannedTopics) {
      const topicLower = topic.toLowerCase();

      // Skip if temporarily ignored
      if (window.tempIgnoredWords && window.tempIgnoredWords.includes(topicLower)) {
        continue;
      }

      const topicWords = topicLower.split(/\s+/);
      let matches = 0;

      for (const tw of topicWords) {
        if (textLower.includes(tw)) matches++;
      }

      // Trigger on 60% word match
      if (matches >= Math.ceil(topicWords.length * 0.6)) {
        const matchConfidence = Math.round((matches / topicWords.length) * 100);
        console.log(`[PredictiveMute] ⚡ TOPIC DETECTED: "${text}" → "${topic}" (${matchConfidence}% match)`);

        // Update confidence bar based on topic match percentage
        updateConfidenceBar(matchConfidence, 'LEAK_INTENT');

        executeInstantMute(topic, text, 'topic');
        return;
      }
    }

    // OPTIMIZATION 4: CONTINUOUS ML INFERENCE with throttling
    // Run ML inference continuously but throttled to avoid CPU overload
    const mlNow = Date.now();
    if (window.intentDetector && window.intentDetector.ready && config.learningEnabled) {
        // Only run ML if enough time has passed (300ms throttle)
        if (mlNow - lastMLInference >= ML_INFERENCE_INTERVAL && text.length >= 5) {
            lastMLInference = mlNow;

            // Non-blocking async ML check
            window.intentDetector.predict(text).then(prediction => {
                if (prediction) {
                    lastMLPrediction = prediction;

                    // Update confidence bar (0-100 scale)
                    const mlConfidence = Math.round(prediction.leak * 100);
                    updateConfidenceBar(mlConfidence, prediction.label);

                    // Check if should mute
                    if (window.intentDetector.shouldMute(prediction, config.confidenceThreshold)) {
                        console.log(`[PredictiveMute] ⚡ ML DETECTED: "${text}"`, prediction);
                        executeInstantMute('sensitive content', text, 'ml');
                    }
                }
            }).catch(e => {
                console.error('[PredictiveMute] ML check failed:', e);
            });
        } else if (lastMLPrediction) {
            // Use cached prediction to update confidence bar
            const mlConfidence = Math.round(lastMLPrediction.leak * 100);
            updateConfidenceBar(mlConfidence, lastMLPrediction.label);
        }
    } else if (text.length >= 3) {
        // Fallback: Show baseline confidence when ML not available
        // Low confidence for normal speech without keyword matches
        updateConfidenceBar(5, 'SAFE');
    }
  }

  // ============================================================================
  // INSTANT MUTE - ONLY AUDIO, NOT CAMERA
  // ============================================================================

  function playMuteBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Cleaner, more subtle notification tone
    // Using a softer sine wave with gentle fade in/out
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(520, audioContext.currentTime); // C5 - pleasant, not jarring

    // Subtle volume with smooth envelope (fade in and out)
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now); // Start silent
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02); // Quick fade in (very subtle volume)
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.06); // Hold
    gainNode.gain.linearRampToValueAtTime(0, now + 0.12); // Smooth fade out

    oscillator.start(now);
    oscillator.stop(now + 0.12); // Short, clean duration
  }

  function executeInstantMute(trigger, text, method) {
    // Just-in-time check to see if the mic is already muted by the user/app
    const alreadyMutedButton = document.querySelector('button[data-is-muted="true"]');
    if (alreadyMutedButton) {
        console.log('[PredictiveMute] Aborting mute, mic is already muted.');
        return;
    }

    console.log('[PredictiveMute] MUTING NOW');
    playMuteBeep();

    isMuted = true;
    lastMuteTime = Date.now();
    updateStatus('muted');

    let success = false;
    let clickedButtonInfo = 'none';

    // Google Meet - AUDIO ONLY
    const meetMicButtons = [
        document.querySelector('button[aria-label*="Turn off microphone"]'), // More specific label
        document.querySelector('button[data-is-muted="false"]'),
    ];

    for (const btn of meetMicButtons) {
        if (btn && btn.offsetParent !== null && (btn.getAttribute('data-is-muted') === 'false' || btn.getAttribute('aria-label')?.toLowerCase().includes('turn off'))) {
            console.log('[PredictiveMute] Clicking button:', {
                tagName: btn.tagName,
                ariaLabel: btn.getAttribute('aria-label'),
                dataIsMuted: btn.getAttribute('data-is-muted'),
                className: btn.className
            });
            btn.click();
            success = true;
            clickedButtonInfo = btn.outerHTML;
            break;
        }
    }

    // Zoom - AUDIO ONLY
    if (!success) {
      const zoomMicBtn = document.querySelector('.footer-button__button[aria-label*="Mute audio"]') ||
                         document.querySelector('button.audio-mute-btn');
      if (zoomMicBtn) {
        console.log('[PredictiveMute] Clicking Zoom button:', {
            tagName: zoomMicBtn.tagName,
            ariaLabel: zoomMicBtn.getAttribute('aria-label'),
            className: zoomMicBtn.className
        });
        zoomMicBtn.click();
        success = true;
        clickedButtonInfo = zoomMicBtn.outerHTML;
      }
    }

    // Method 2: Direct audio track disable (fallback)
    if (!success) {
      const audioTracks = getAllAudioTracks();
      if (audioTracks.length > 0) {
        console.log(`[PredictiveMute] Disabling ${audioTracks.length} audio tracks.`);
        audioTracks.forEach(track => {
            console.log('[PredictiveMute] Disabling track:', track.label, track.id, track.kind);
            if (track.kind === 'audio') {
                track.enabled = false;
            }
        });
        success = true;
        clickedButtonInfo = `${audioTracks.length} audio tracks processed.`;
      }
    }

    if (success) {
      // Recognition is no longer stopped to ensure it's always on.
      showAlert(trigger, text, method);
      addLog(`MUTED: "${text}" (${method}). Method: ${clickedButtonInfo}`, true);
      startUnmuteMonitoring();
    } else {
      console.warn('[PredictiveMute] Mute failed - no method worked');
      isMuted = false;
    }
  }

  function getAllAudioTracks() {
    const tracks = [];

    // Get from media elements
    document.querySelectorAll('audio, video').forEach(el => {
      if (el.srcObject && el.srcObject.getAudioTracks) {
        tracks.push(...el.srcObject.getAudioTracks());
      }
    });

    return tracks;
  }

  function startUnmuteMonitoring() {
    const checkInterval = 300; // Fast polling
    let checks = 0;

    const check = () => {
      if (!isMuted) return;
      if (checks++ > 1000) { // 5 min max
        isMuted = false;
        updateStatus('listening');
        return;
      }

      const handleUnmute = () => {
        console.log('[PredictiveMute] Detected unmute');
        isMuted = false;
        isRecovering = true;
        updateStatus('recovering'); // New status
        setTimeout(() => {
            isRecovering = false;
            // No need to restart monitoring, it was never stopped.
            if (isListening) {
                updateStatus('listening');
            }
        }, RECOVERY_TIME);
      };

      // Check if manually unmuted
      const meetUnmuted = document.querySelector('button[data-is-muted="true"]') ||
                          document.querySelector('button[aria-label*="microphone" i][aria-label*="on" i]');

      if (meetUnmuted) {
        handleUnmute();
        return;
      }

      // Check audio tracks
      const tracks = getAllAudioTracks();
      if (tracks.some(t => t.enabled)) {
        handleUnmute();
        return;
      }

      setTimeout(check, checkInterval);
    };

    setTimeout(check, checkInterval);
  }

  // ============================================================================
  // UI - CLEAN STATUS INDICATOR
  // ============================================================================

  function injectStatusIndicator() {
    // Remove existing container if present
    const existingContainer = document.getElementById('pm-container');
    if (existingContainer) existingContainer.remove();

    // Create container for both indicator and confidence bar
    const container = document.createElement('div');
    container.id = 'pm-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      z-index: 999999;
    `;

    // Status indicator (mic button)
    const indicator = document.createElement('div');
    indicator.id = 'pm-status';
    indicator.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #2f3136;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    indicator.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#b9bbbe" d="M12 2C11.45 2 11 2.45 11 3V11C11 11.55 11.45 12 12 12C12.55 12 13 11.55 13 11V3C13 2.45 12.55 2 12 2ZM12 14C9.24 14 7 16.24 7 19V21H17V19C17 16.24 14.76 14 12 14Z"/></svg>`;
    indicator.title = 'Predictive Mute: Idle';

    indicator.addEventListener('click', () => {
      if (isListening) {
        stopMonitoring();
      } else {
        startMonitoring();
      }
    });

    // Confidence bar
    const confidenceBar = document.createElement('div');
    confidenceBar.id = 'pm-confidence-bar';
    confidenceBar.style.cssText = `
      width: 200px;
      height: 8px;
      background: rgba(47, 49, 54, 0.9);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: none;
      backdrop-filter: blur(10px);
    `;

    const confidenceFill = document.createElement('div');
    confidenceFill.id = 'pm-confidence-fill';
    confidenceFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #43b581 0%, #faa61a 50%, #f04747 100%);
      transition: width 0.2s ease, background 0.3s ease;
      border-radius: 8px;
    `;

    const confidenceLabel = document.createElement('div');
    confidenceLabel.id = 'pm-confidence-label';
    confidenceLabel.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 500;
      margin-top: 4px;
      text-align: right;
      display: none;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    `;
    confidenceLabel.textContent = 'Confidence: 0%';

    confidenceBar.appendChild(confidenceFill);
    container.appendChild(confidenceBar);
    container.appendChild(confidenceLabel);
    container.appendChild(indicator);

    document.body.appendChild(container);
  }

  function updateStatus(state) {
    const indicator = document.getElementById('pm-status');
    if (!indicator) return;

    const idleIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#b9bbbe" d="M12 2C11.45 2 11 2.45 11 3V11C11 11.55 11.45 12 12 12C12.55 12 13 11.55 13 11V3C13 2.45 12.55 2 12 2ZM12 14C9.24 14 7 16.24 7 19V21H17V19C17 16.24 14.76 14 12 14Z"/></svg>`;
    const listeningIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#43b581" d="M12 2C11.45 2 11 2.45 11 3V11C11 11.55 11.45 12 12 12C12.55 12 13 11.55 13 11V3C13 2.45 12.55 2 12 2ZM12 14C9.24 14 7 16.24 7 19V21H17V19C17 16.24 14.76 14 12 14Z"/></svg>`;
    const mutedIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#ffffff" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2s-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>`;

    const states = {
      idle: { icon: idleIcon, title: 'Idle', bg: '#2f3136' },
      listening: { icon: listeningIcon, title: 'Listening', bg: '#2f3136' },
      muted: { icon: mutedIcon, title: 'Muted', bg: '#f04747' },
      recovering: { icon: mutedIcon, title: 'Recovering', bg: '#f04747' }
    };

    const s = states[state] || states.idle;
    indicator.innerHTML = s.icon;
    indicator.style.background = s.bg;
    indicator.title = `Predictive Mute: ${s.title}`;

    indicator.style.animation = 'none'; // Reset animation

    // Show/hide confidence bar based on state
    const confidenceBar = document.getElementById('pm-confidence-bar');
    const confidenceLabel = document.getElementById('pm-confidence-label');
    if (confidenceBar && confidenceLabel) {
      if (state === 'listening') {
        confidenceBar.style.display = 'block';
        confidenceLabel.style.display = 'block';
      } else {
        confidenceBar.style.display = 'none';
        confidenceLabel.style.display = 'none';
      }
    }
  }

  function updateConfidenceBar(confidence, label = 'SAFE') {
    const confidenceFill = document.getElementById('pm-confidence-fill');
    const confidenceLabel = document.getElementById('pm-confidence-label');

    if (!confidenceFill || !confidenceLabel) return;

    // Update confidence bar width (0-100%)
    const clampedConfidence = Math.max(0, Math.min(100, confidence));
    confidenceFill.style.width = `${clampedConfidence}%`;

    // Update label with status
    const status = label === 'LEAK_INTENT' ? '⚠️ LEAK' : '✓ SAFE';
    confidenceLabel.textContent = `${status} ${clampedConfidence}%`;

    // Color coding based on confidence level
    if (clampedConfidence < 30) {
      confidenceFill.style.background = '#43b581'; // Green - safe
      confidenceLabel.style.color = '#43b581';
    } else if (clampedConfidence < 70) {
      confidenceFill.style.background = '#faa61a'; // Orange - warning
      confidenceLabel.style.color = '#faa61a';
    } else {
      confidenceFill.style.background = '#f04747'; // Red - danger
      confidenceLabel.style.color = '#f04747';
    }

    // Store current confidence
    currentConfidence = clampedConfidence;
  }

  // ============================================================================
  // ALERT - NEW NOTIFICATION STYLE
  // ============================================================================

  function showAlert(trigger, text, method) {
    const existing = document.getElementById('pm-notification-overlay');
    if (existing) existing.remove();

    const notificationOverlay = document.createElement('div');
    notificationOverlay.id = 'pm-notification-overlay';
    notificationOverlay.className = 'notification-overlay';

    notificationOverlay.innerHTML = `
      <div class="notification-container">
        <!-- Main Notification Panel -->
        <div class="notification-panel">
          <div class="notification-header">
            <div class="notification-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4L8 12L16 20" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 4L0 12L8 20" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="notification-content">
              <p class="notification-message" id="notificationMessage">
                We automatically muted your microphone because you talked about a blacklisted topic: <strong>${trigger}</strong>.
              </p>
            </div>
          </div>

          <div class="notification-actions">
            <button class="btn btn-primary" id="addToWhitelistBtn">
              Add topic to whitelist
            </button>
            
            <div class="secondary-actions">
              <button class="btn btn-secondary" id="ignoreNowBtn">
                Ignore for now
              </button>
              <button class="btn btn-secondary" id="ignoreCallBtn">
                Ignore for this call
              </button>
            </div>
            
            <a href="#" class="transcript-link" id="showTranscriptLink">
              Show transcript
            </a>
          </div>
        </div>

        <!-- Transcript Panel (Hidden by default) -->
        <div class="transcript-panel" id="transcriptPanel">
          <div class="transcript-header">
            <h3>Transcript</h3>
          </div>
          <div class="transcript-content" id="transcriptContent">
            <p class="transcript-line">${text}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(notificationOverlay);

    const showTranscriptLink = notificationOverlay.querySelector('#showTranscriptLink');
    const transcriptPanel = notificationOverlay.querySelector('#transcriptPanel');

    showTranscriptLink.addEventListener('click', (e) => {
      e.preventDefault();
      transcriptPanel.classList.toggle('show');
    });

    // Add to whitelist button
    const addToWhitelistBtn = notificationOverlay.querySelector('#addToWhitelistBtn');
    addToWhitelistBtn.addEventListener('click', () => {
        // Remove from sensitive words
        const index = config.sensitiveWords.findIndex(w => w.toLowerCase() === trigger.toLowerCase());
        if (index !== -1) {
            config.sensitiveWords.splice(index, 1);
            chrome.storage.sync.set({ sensitiveWords: config.sensitiveWords }, () => {
                addLog(`✓ Removed "${trigger}" from blacklist`, false);
            });

            // Rebuild prefix map with updated word list
            buildPrefixMap();
        }

        // Close notification
        notificationOverlay.querySelector('.notification-container').classList.add('hide');
        setTimeout(() => notificationOverlay.remove(), 300);
    });

    // Ignore for now button
    const ignoreNowBtn = notificationOverlay.querySelector('#ignoreNowBtn');
    ignoreNowBtn.addEventListener('click', () => {
        addLog(`Ignored "${trigger}" for now`, false);
        notificationOverlay.querySelector('.notification-container').classList.add('hide');
        setTimeout(() => notificationOverlay.remove(), 300);
    });

    // Ignore for this call button
    const ignoreCallBtn = notificationOverlay.querySelector('#ignoreCallBtn');
    ignoreCallBtn.addEventListener('click', () => {
        // Create temporary ignore list for this session
        if (!window.tempIgnoredWords) {
            window.tempIgnoredWords = [];
        }
        window.tempIgnoredWords.push(trigger.toLowerCase());
        addLog(`Ignoring "${trigger}" for this call`, false);

        notificationOverlay.querySelector('.notification-container').classList.add('hide');
        setTimeout(() => notificationOverlay.remove(), 300);
    });


    setTimeout(() => {
        if (notificationOverlay.parentNode) {
            notificationOverlay.querySelector('.notification-container').classList.add('hide');
            setTimeout(() => notificationOverlay.remove(), 300);
        }
    }, 7000);
  }

  // ============================================================================
  // LEARNING
  // ============================================================================

  function handleFeedback(trigger, text, isCorrect) {
    if (isCorrect) {
      learningData.truePositives.push({ trigger, text, timestamp: Date.now() });
      addLog(`✓ Confirmed: "${text}"`, false);
    } else {
      learningData.falsePositives.push(text);
      learningData.corrections++;
      addLog(`✗ False positive: "${text}"`, true);
    }
    chrome.storage.local.set({ learningData });
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  function addLog(message, isWarning) {
    logs.push({ message, timestamp: Date.now(), isWarning });
    if (logs.length > MAX_LOGS) logs.shift();
    chrome.storage.local.set({ logs });
  }

  // ============================================================================
  // ANIMATION STYLES
  // ============================================================================

  const style = document.createElement('style');
  style.textContent = `
    .notification-overlay {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 10000;
      width: auto;
      height: auto;
    }

    .notification-container {
      display: flex;
      gap: 20px;
      max-width: 600px;
      width: 90%;
      animation: slideInFromBottomLeft 0.5s ease-out forwards;
    }

    @keyframes slideInFromBottomLeft {
      from {
        opacity: 0;
        transform: translate(-20px, 20px);
      }
      to {
        opacity: 1;
        transform: translate(0, 0);
      }
    }

    .notification-panel {
      background: #282828;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(139, 92, 246, 0.2);
      min-width: 400px;
      max-width: 500px;
    }

    .notification-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
    }

    .notification-icon {
      color: #8b5cf6;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .notification-content {
      flex: 1;
    }

    .notification-message {
      font-size: 16px;
      line-height: 1.5;
      color: #e2e8f0;
      font-weight: 400;
    }

    .notification-actions {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .btn {
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .btn-primary {
      background: #8b5cf6;
      color: white;
      padding: 12px 24px;
      width: 100%;
    }

    .btn-primary:hover {
      background: #7c3aed;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }

    .secondary-actions {
      display: flex;
      gap: 12px;
    }

    .btn-secondary {
      background: transparent;
      color: #e2e8f0;
      border: 1px solid #64748b;
      padding: 10px 20px;
      flex: 1;
    }

    .btn-secondary:hover {
      background: rgba(100, 116, 139, 0.1);
      border-color: #8b5cf6;
      color: #8b5cf6;
    }

    .transcript-link {
      color: #64748b;
      text-decoration: underline;
      font-size: 14px;
      text-align: center;
      transition: color 0.2s ease;
    }

    .transcript-link:hover {
      color: #8b5cf6;
    }

    .transcript-panel {
      background: #282828;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(139, 92, 246, 0.2);
      min-width: 300px;
      max-width: 400px;
      display: none;
    }

    .transcript-panel.show {
      display: block;
      animation: slideInFromBottomLeft 0.3s ease-out;
    }

    .transcript-header h3 {
      color: #e2e8f0;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .transcript-content {
      max-height: 300px;
      overflow-y: auto;
    }

    .transcript-line {
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
      margin-bottom: 8px;
      padding: 4px 0;
    }

    .transcript-line.flagged {
      color: #8b5cf6;
      text-decoration: underline;
      font-weight: 500;
    }
    
    .notification-container.hide {
      animation: slideOutToBottomLeft 0.3s ease-in forwards;
    }

    @keyframes slideOutToBottomLeft {
      from {
        opacity: 1;
        transform: translate(0, 0);
      }
      to {
        opacity: 0;
        transform: translate(-20px, 20px);
      }
    }
    
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 15px #00ffea; }
      50% { box-shadow: 0 0 25px #00ffea, 0 0 15px #00ffea; }
    }
    @keyframes pulse-red {
      0%, 100% { box-shadow: 0 0 15px #ff00ff; }
      50% { box-shadow: 0 0 25px #ff00ff, 0 0 15px #ff00ff; }
    }
  `;
  document.head.appendChild(style);

  // ============================================================================
  // START
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[PredictiveMute] Loaded');
})();