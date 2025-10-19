// Popup script for Predictive Mute v2.0

(function() {
  'use strict';

  // DOM elements
  const enabledToggle = document.getElementById('enabledToggle');
  const audioToggle = document.getElementById('audioToggle');
  const learningToggle = document.getElementById('learningToggle');
  const bufferSlider = document.getElementById('bufferSlider');
  const bufferValue = document.getElementById('bufferValue');
  const confidenceSlider = document.getElementById('confidenceSlider');
  const confidenceValue = document.getElementById('confidenceValue');
  const sensitiveWordsInput = document.getElementById('sensitiveWordsInput');
  const bannedTopicsInput = document.getElementById('bannedTopicsInput');
  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsContent = document.getElementById('settingsContent');
  const statsGrid = document.getElementById('statsGrid');
  const correctCount = document.getElementById('correctCount');
  const correctedCount = document.getElementById('correctedCount');
  const resetLearningBtn = document.getElementById('resetLearningBtn');
  const advancedSection = document.getElementById('advancedSection');

  // Load settings
  function loadSettings() {
    chrome.storage.sync.get([
      'enabled',
      'audioEnabled',
      'learningEnabled',
      'predictionBuffer',
      'minConfidence',
      'sensitiveWords',
      'bannedTopics'
    ], (data) => {
      enabledToggle.checked = data.enabled !== false;
      audioToggle.checked = data.audioEnabled !== false;
      learningToggle.checked = data.learningEnabled !== false;
      bufferSlider.value = data.predictionBuffer || 350;
      bufferValue.textContent = data.predictionBuffer || 350;
      confidenceSlider.value = data.minConfidence || 0.8;
      confidenceValue.textContent = Math.round((data.minConfidence || 0.8) * 100);

      const sensitiveWords = data.sensitiveWords || ["password", "credit", "card", "confidential", "secret", "ssn", "bank"];
      sensitiveWordsInput.value = sensitiveWords.join(', ');

      const bannedTopics = data.bannedTopics || [];
      bannedTopicsInput.value = bannedTopics.join(', ');

      updateStatus(data.enabled && data.audioEnabled);
    });

    // Load learning stats
    chrome.storage.local.get(['learningData'], (data) => {
      if (data.learningData) {
        const truePos = data.learningData.truePositives?.length || 0;
        const falsePos = data.learningData.corrections || 0;

        if (truePos > 0 || falsePos > 0) {
          statsGrid.style.display = 'grid';
          correctCount.textContent = truePos;
          correctedCount.textContent = falsePos;
        }
      }
    });
  }

  // Update status indicator
  function updateStatus(isActive) {
    if (isActive) {
      statusDot.className = 'status-dot active';
      statusLabel.textContent = 'Predictive Mute Active';
    } else {
      statusDot.className = 'status-dot';
      statusLabel.textContent = 'Predictive Mute Paused';
    }
  }

  // Save settings and notify content script
  function saveSettings() {
    const settings = {
      enabled: enabledToggle.checked,
      audioEnabled: audioToggle.checked,
      learningEnabled: learningToggle.checked,
      predictionBuffer: parseInt(bufferSlider.value),
      minConfidence: parseFloat(confidenceSlider.value),
      sensitiveWords: sensitiveWordsInput.value.split(',').map(w => w.trim()).filter(w => w),
      bannedTopics: bannedTopicsInput.value.split(',').map(t => t.trim()).filter(t => t)
    };

    chrome.storage.sync.set(settings, () => {
      console.log('[Popup v2] Settings saved:', settings);

      // Notify content scripts
      chrome.tabs.query({ url: ["*://meet.google.com/*", "*://*.zoom.us/*"] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          }).catch(() => {
            console.log('[Popup v2] Could not send message to tab', tab.id);
          });
        });
      });

      updateStatus(settings.enabled && settings.audioEnabled);
    });
  }

  // Event listeners
  enabledToggle.addEventListener('change', saveSettings);
  audioToggle.addEventListener('change', saveSettings);
  learningToggle.addEventListener('change', () => {
    saveSettings();
    // Show/hide stats based on learning toggle
    if (learningToggle.checked) {
      loadSettings(); // Reload to show stats if any
    } else {
      statsGrid.style.display = 'none';
    }
  });

  bufferSlider.addEventListener('input', (e) => {
    bufferValue.textContent = e.target.value;
  });
  bufferSlider.addEventListener('change', saveSettings);

  confidenceSlider.addEventListener('input', (e) => {
    confidenceValue.textContent = Math.round(e.target.value * 100);
  });
  confidenceSlider.addEventListener('change', saveSettings);

  sensitiveWordsInput.addEventListener('blur', saveSettings);
  bannedTopicsInput.addEventListener('blur', saveSettings);

  // Settings toggle
  settingsToggle.addEventListener('click', () => {
    const isOpen = settingsContent.classList.contains('open');
    if (isOpen) {
      settingsContent.classList.remove('open');
      settingsToggle.querySelector('.toggle-icon').textContent = '▼';
    } else {
      settingsContent.classList.add('open');
      settingsToggle.querySelector('.toggle-icon').textContent = '▲';
    }
  });

  // Reset learning data
  resetLearningBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all learning data? This cannot be undone.')) {
      chrome.storage.local.set({
        learningData: {
          falsePositives: [],
          truePositives: [],
          corrections: 0,
          adaptiveWeights: {}
        }
      }, () => {
        correctCount.textContent = '0';
        correctedCount.textContent = '0';
        alert('Learning data has been reset.');
      });
    }
  });

  // Show advanced section on double-click of title
  let clickCount = 0;
  document.querySelector('.title-container').addEventListener('click', () => {
    clickCount++;
    if (clickCount >= 3) {
      advancedSection.style.display = advancedSection.style.display === 'none' ? 'block' : 'none';
      clickCount = 0;
    }
    setTimeout(() => { clickCount = 0; }, 1000);
  });

  // Initialize
  loadSettings();

  console.log('[Popup v2] Initialized');
})();
