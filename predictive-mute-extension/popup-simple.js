// Simple popup controller
(function() {
  'use strict';

  const enabledToggle = document.getElementById('enabledToggle');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const sensitiveWords = document.getElementById('sensitiveWords');
  const bannedTopics = document.getElementById('bannedTopics');
  const statsSection = document.getElementById('statsSection');
  const correctCount = document.getElementById('correctCount');
  const falseCount = document.getElementById('falseCount');

  function loadSettings() {
    chrome.storage.sync.get([
      'enabled',
      'sensitiveWords',
      'bannedTopics'
    ], (data) => {
      enabledToggle.checked = data.enabled !== false;

      const words = data.sensitiveWords || ["password", "credit", "card", "confidential", "secret", "ssn", "bank"];
      sensitiveWords.value = words.join(', ');

      const topics = data.bannedTopics || [];
      bannedTopics.value = topics.join(', ');

      updateStatus(data.enabled !== false);
    });

    chrome.storage.local.get(['learningData'], (data) => {
      if (data.learningData) {
        const correct = data.learningData.truePositives?.length || 0;
        const false_pos = data.learningData.corrections || 0;

        if (correct > 0 || false_pos > 0) {
          statsSection.style.display = 'flex';
          correctCount.textContent = correct;
          falseCount.textContent = false_pos;
        }
      }
    });
  }

  function updateStatus(isActive) {
    if (isActive) {
      statusDot.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'Paused';
    }
  }

  function saveSettings() {
    const settings = {
      enabled: enabledToggle.checked,
      audioEnabled: enabledToggle.checked,
      learningEnabled: true,
      predictionBuffer: 350,
      minConfidence: 0.8,
      sensitiveWords: sensitiveWords.value.split(',').map(w => w.trim()).filter(w => w),
      bannedTopics: bannedTopics.value.split(',').map(t => t.trim()).filter(t => t)
    };

    chrome.storage.sync.set(settings, () => {
      console.log('[Popup] Settings saved');

      chrome.tabs.query({ url: ["*://meet.google.com/*", "*://*.zoom.us/*"] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          }).catch(() => {});
        });
      });

      updateStatus(settings.enabled);
    });
  }

  enabledToggle.addEventListener('change', saveSettings);
  sensitiveWords.addEventListener('blur', saveSettings);
  bannedTopics.addEventListener('blur', saveSettings);

  loadSettings();
})();
