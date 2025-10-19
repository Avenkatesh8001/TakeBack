// Predictive Mute - Clean, Fast, Working Version
// Detects sensitive words BEFORE they're spoken to the meeting
//main content file with all the states and different white list common words
//and predictive ai functions
(function() {
  'use strict';

  console.log('[PredictiveMute] Starting...');

  // CONFIG
  let config = {
    enabled: true,
    sensitiveWords: ["password", "credit", "card", "confidential", "secret", "ssn", "bank", "fuck", "shit", "damn"],
    bannedTopics: [],
    learningEnabled: true
  };

  // STATE
  let recognition = null;
  let isListening = false;
  let isMuted = false;
  let lastMuteTime = 0;
  let logs = [];
  const MUTE_COOLDOWN = 2000;
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
    chrome.storage.sync.get(['enabled', 'sensitiveWords', 'bannedTopics', 'learningEnabled'], (data) => {
      if (data.enabled !== undefined) config.enabled = data.enabled;
      if (data.sensitiveWords) config.sensitiveWords = data.sensitiveWords;
      if (data.bannedTopics) config.bannedTopics = data.bannedTopics;
      if (data.learningEnabled !== undefined) config.learningEnabled = data.learningEnabled;

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
      console.log('[PredictiveMute] Recognition ended');
      if (isListening && config.enabled) {
        // Auto-restart
        setTimeout(() => {
          if (recognition && config.enabled) {
            try {
              recognition.start();
            } catch (e) {
              console.error('[PredictiveMute] Restart failed:', e);
            }
          }
        }, 100);
      } else {
        isListening = false;
        updateStatus('idle');
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
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
    isListening = false;
    updateStatus('idle');
    console.log('[PredictiveMute] Monitoring stopped');
  }

  // ============================================================================
  // DETECTION & MUTING - INSTANT
  // ============================================================================

  function checkAndMute(text, confidence, isFinal) {
    // Skip if already muted
    if (isMuted) return;

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
    if (window.MLClassifier && isFinal) {
      try {
        const mlResult = window.MLClassifier.classifyByKeywords(text);
        if (window.MLClassifier.shouldMute(mlResult)) {
          console.log('[PredictiveMute] ML DETECTED:', text);
          executeInstantMute(mlResult.label, text, 'ml');
        }
      } catch (e) {
        // Silent fail
      }
    }
  }

  // ============================================================================
  // INSTANT MUTE - ONLY AUDIO, NOT CAMERA
  // ============================================================================

  function executeInstantMute(trigger, text, method) {
    console.log('[PredictiveMute] MUTING NOW');

    isMuted = true;
    lastMuteTime = Date.now();
    updateStatus('muted');

    // Method 1: Click ONLY the microphone button (NOT camera)
    let success = false;

    // Google Meet - AUDIO ONLY
    const meetMicButtons = [
      document.querySelector('button[aria-label*="microphone" i][aria-label*="off" i]'),
      document.querySelector('button[data-is-muted="false"]'),
      document.querySelector('[jsname][aria-label*="Turn off microphone"]'),
      document.querySelector('.google-material-icons:has-text("mic") ~ button')
    ].filter(Boolean);

    for (const btn of meetMicButtons) {
      if (btn && btn.offsetParent !== null) {
        btn.click();
        success = true;
        console.log('[PredictiveMute] Clicked Google Meet mic button');
        break;
      }
    }

    // Zoom - AUDIO ONLY
    if (!success) {
      const zoomMicBtn = document.querySelector('.footer-button__button[aria-label*="Mute audio"]') ||
                         document.querySelector('button.audio-mute-btn');
      if (zoomMicBtn) {
        zoomMicBtn.click();
        success = true;
        console.log('[PredictiveMute] Clicked Zoom mic button');
      }
    }

    // Method 2: Direct audio track disable (fallback)
    if (!success) {
      const audioTracks = getAllAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach(track => {
          track.enabled = false;
        });
        success = true;
        console.log('[PredictiveMute] Disabled', audioTracks.length, 'audio tracks');
      }
    }

    if (success) {
      showAlert(trigger, text, method);
      addLog(`MUTED: "${text}" (${method})`, true);
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

      // Check if manually unmuted
      const meetUnmuted = document.querySelector('button[data-is-muted="true"]') ||
                          document.querySelector('button[aria-label*="microphone" i][aria-label*="on" i]');

      if (meetUnmuted) {
        console.log('[PredictiveMute] Detected unmute');
        isMuted = false;
        updateStatus('listening');
        return;
      }

      // Check audio tracks
      const tracks = getAllAudioTracks();
      if (tracks.some(t => t.enabled)) {
        console.log('[PredictiveMute] Audio track enabled');
        isMuted = false;
        updateStatus('listening');
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
      top: 16px;
      right: 16px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 3px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      z-index: 999999;
      transition: all 0.3s ease;
    `;
    indicator.innerHTML = '🎤';
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

    const states = {
      idle: { icon: '🎤', bg: '#6b7280', title: 'Idle' },
      listening: { icon: '✅', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', title: 'Listening' },
      muted: { icon: '🔇', bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', title: 'Muted' }
    };

    const s = states[state] || states.idle;
    indicator.innerHTML = s.icon;
    indicator.style.background = s.bg;
    indicator.title = `Predictive Mute: ${s.title}`;

    if (state === 'muted') {
      indicator.style.animation = 'pulse 1s infinite';
    } else {
      indicator.style.animation = 'none';
    }
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 32px 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(124, 58, 237, 0.3);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      text-align: center;
      max-width: 450px;
      animation: slideIn 0.3s ease-out;
    `;

    const emoji = method === 'keyword' ? '🔐' : method === 'topic' ? '🔇' : '🤖';

    alert.innerHTML = `
      <div style="font-size: 56px; margin-bottom: 16px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">${emoji}</div>
      <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        MICROPHONE MUTED
      </div>
      <div style="font-size: 14px; opacity: 0.8; margin-bottom: 20px;">
        Detected: "${trigger}"
      </div>
      <div style="font-size: 12px; opacity: 0.6; font-style: italic; margin-bottom: 24px; max-width: 350px; word-wrap: break-word;">
        "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"
      </div>
      ${config.learningEnabled ? `
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 12px;">Was this correct?</div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="pm-yes" style="padding: 10px 24px; background: rgba(52, 211, 153, 0.2); border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 12px; color: #34d399; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s;">
            ✓ Yes
          </button>
          <button id="pm-no" style="padding: 10px 24px; background: rgba(248, 113, 113, 0.2); border: 1px solid rgba(248, 113, 113, 0.4); border-radius: 12px; color: #f87171; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s;">
            ✗ No
          </button>
        </div>
      ` : ''}
      <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
        Click your mute button to unmute
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
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.9; }
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
