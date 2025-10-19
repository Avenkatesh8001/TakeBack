// Clean popup controller
(function() {
  'use strict';

  const enableToggle = document.getElementById('enableToggle');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const sensitiveWords = document.getElementById('sensitiveWords');
  const bannedTopics = document.getElementById('bannedTopics');
  const statsBox = document.getElementById('statsBox');
  const correctCount = document.getElementById('correctCount');
  const falseCount = document.getElementById('falseCount');

  function loadSettings() {
    chrome.storage.sync.get(['enabled', 'sensitiveWords', 'bannedTopics'], (data) => {
      enableToggle.checked = data.enabled !== false;

      const words = data.sensitiveWords || ["password", "credit", "card", "confidential", "secret", "ssn", "bank", "fuck", "shit", "damn"];
      sensitiveWords.value = words.join(', ');

      const topics = data.bannedTopics || [];
      bannedTopics.value = topics.join(', ');

      updateStatus(data.enabled !== false);
    });

    chrome.storage.local.get(['learningData'], (data) => {
      if (data.learningData) {
        const correct = data.learningData.truePositives?.length || 0;
        const incorrect = data.learningData.corrections || 0;

        if (correct > 0 || incorrect > 0) {
          statsBox.style.display = 'grid';
          correctCount.textContent = correct;
          falseCount.textContent = incorrect;
        }
      }
    });
  }

  function updateStatus(isActive) {
    if (isActive) {
      statusIcon.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      statusIcon.classList.remove('active');
      statusText.textContent = 'Paused';
    }
  }

  function saveSettings() {
    const settings = {
      enabled: enableToggle.checked,
      sensitiveWords: sensitiveWords.value.split(',').map(w => w.trim()).filter(w => w),
      bannedTopics: bannedTopics.value.split(',').map(t => t.trim()).filter(t => t),
      learningEnabled: true
    };

    chrome.storage.sync.set(settings, () => {
      console.log('[Popup] Saved');

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

  enableToggle.addEventListener('change', saveSettings);
  sensitiveWords.addEventListener('blur', saveSettings);
  bannedTopics.addEventListener('blur', saveSettings);

  loadSettings();
})();
