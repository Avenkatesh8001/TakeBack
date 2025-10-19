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

  // WHITELIST - never mute these
  const SAFE_WORDS = ['hello', 'hi', 'hey', 'okay', 'ok', 'thanks', 'thank', 'please', 'yes', 'no', 'sure', 'great', 'good', 'bye'];

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
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('[PredictiveMute] Monitoring started');
      isListening = true;
      updateStatus('listening');
      addLog('Monitoring started', false);
    };

    recognition.onresult = (event) => {
      // Process EVERY result immediately for speed
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.toLowerCase().trim();
        const confidence = result[0].confidence || 1.0;
        const isFinal = result.isFinal;

        // Check IMMEDIATELY on interim results (this is the speed boost)
        if (transcript.length > 0) {
          checkAndMute(transcript, confidence, isFinal);
        }
      }
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
  // DETECTION & MUTING - INSTANT
  // ============================================================================

  function checkAndMute(text, confidence, isFinal) {
    // Skip if already muted or recovering
    if (isMuted || isRecovering) return;

    // Skip if in cooldown
    const now = Date.now();
    if (now - lastMuteTime < MUTE_COOLDOWN) return;

    // Quick whitelist check
    const words = text.split(/\s+/);
    const allSafe = words.every(word => SAFE_WORDS.includes(word));
    if (allSafe) return;

    // Filter learned false positives
    if (learningData.falsePositives.some(fp => text.includes(fp.toLowerCase()))) {
      return;
    }

    // Check sensitive words
    for (const sensitiveWord of config.sensitiveWords) {
      const lower = sensitiveWord.toLowerCase();

      // Exact match or partial match
      if (text.includes(lower) || words.some(w => w.startsWith(lower.substring(0, Math.min(4, lower.length))))) {
        console.log('[PredictiveMute] DETECTED:', text, '| Word:', sensitiveWord);
        executeInstantMute(sensitiveWord, text, 'keyword');
        return;
      }
    }

    // Check banned topics (semantic)
    for (const topic of config.bannedTopics) {
      const topicLower = topic.toLowerCase();
      const topicWords = topicLower.split(/\s+/);
      const matchedWords = topicWords.filter(tw => text.includes(tw));

      if (matchedWords.length >= Math.ceil(topicWords.length * 0.6)) {
        console.log('[PredictiveMute] BANNED TOPIC:', text, '| Topic:', topic);
        executeInstantMute(topic, text, 'topic');
        return;
      }
    }

    // Check ML if available
    if (window.MLClassifier && isFinal && config.learningEnabled) {
        (async () => {
            try {
                const mlResult = await window.MLClassifier.classify(text, config.bannedTopics);
                if (mlResult && mlResult.label !== 'SAFE' && mlResult.score >= config.confidenceThreshold) {
                    if (window.MLClassifier.shouldMute(mlResult)) {
                        console.log('[PredictiveMute] ML DETECTED:', text, mlResult);
                        executeInstantMute(mlResult.label, text, 'ml');
                    }
                }
            } catch (e) {
                console.error('[PredictiveMute] ML classification failed:', e);
            }
        })();
    }
  }

  // ============================================================================
  // INSTANT MUTE - ONLY AUDIO, NOT CAMERA
  // ============================================================================

  function executeInstantMute(trigger, text, method) {
    // Just-in-time check to see if the mic is already muted by the user/app
    const alreadyMutedButton = document.querySelector('button[data-is-muted="true"]');
    if (alreadyMutedButton) {
        console.log('[PredictiveMute] Aborting mute, mic is already muted.');
        return;
    }

    console.log('[PredictiveMute] MUTING NOW');

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
    const existing = document.getElementById('pm-status');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'pm-status';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #2f3136;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999999;
      transition: all 0.3s ease;
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

    document.body.appendChild(indicator);
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
  }

  // ============================================================================
  // ALERT - CLEAN & SIMPLE
  // ============================================================================

  function showAlert(trigger, text, method) {
    const existing = document.getElementById('pm-alert');
    if (existing) existing.remove();

    const alert = document.createElement('div');
    alert.id = 'pm-alert';
    alert.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #2f3136;
      color: #dcddde;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.24);
      z-index: 9999999;
      font-family: 'Open Sans', sans-serif;
      text-align: center;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    const icon = `<svg width="48" height="48" viewBox="0 0 24 24"><path fill="#f04747" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2s-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>`;

    alert.innerHTML = `
      <div style="margin-bottom: 16px;">${icon}</div>
      <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #ffffff;">
        MICROPHONE MUTED
      </div>
      <div style="font-size: 14px; color: #b9bbbe; margin-bottom: 20px;">
        Sensitive content detected: <strong>${trigger}</strong>
      </div>
      <div style="font-size: 12px; color: #dcddde; margin-bottom: 24px; max-width: 350px; word-wrap: break-word; background: #202225; padding: 10px; border-radius: 3px;">
        <em>"${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"</em>
      </div>
      ${config.learningEnabled ? `
        <div style="font-size: 13px; color: #b9bbbe; margin-bottom: 12px;">Was this correct?</div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="pm-yes" style="padding: 10px 20px; background: #43b581; border: none; border-radius: 3px; color: white; cursor: pointer; font-family: 'Open Sans', sans-serif; font-weight: 600;">
            Yes
          </button>
          <button id="pm-no" style="padding: 10px 20px; background: #f04747; border: none; border-radius: 3px; color: white; cursor: pointer; font-family: 'Open Sans', sans-serif; font-weight: 600;">
            No
          </button>
        </div>
      ` : ''}
      <div style="margin-top: 20px; font-size: 12px; color: #72767d;">
        You can unmute yourself in the meeting.
      </div>
    `;

    document.body.appendChild(alert);

    if (config.learningEnabled) {
      document.getElementById('pm-yes')?.addEventListener('click', () => {
        handleFeedback(trigger, text, true);
        alert.remove();
      });
      document.getElementById('pm-no')?.addEventListener('click', () => {
        handleFeedback(trigger, text, false);
        alert.remove();
      });
    }

    setTimeout(() => {
      if (alert.parentNode) {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
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

    // Record feedback in feedback collector for model retraining
    if (window.feedbackCollector) {
      const detectionResult = {
        decision: 'MUTE',
        confidence: 0.8, // Default confidence
        reason: trigger,
        breakdown: {}
      };
      const userLabel = isCorrect ? 1 : 0; // 1=leak, 0=safe
      window.feedbackCollector.recordFeedback(text, detectionResult, userLabel);
    }
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
    @keyframes slideIn {
      from { opacity: 0; transform: translate(-50%, -60%); }
      to { opacity: 1; transform: translate(-50%, -50%); }
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
