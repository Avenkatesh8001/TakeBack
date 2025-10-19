document.addEventListener('DOMContentLoaded', () => {
    const enabledToggle = document.getElementById('enabled');
    const bannedTopicsTextarea = document.getElementById('banned-topics');
    const prefixMatchingEnabledToggle = document.getElementById('prefix-matching-enabled');
    const synonymDetectionEnabledToggle = document.getElementById('synonym-detection-enabled');
    const smartContextEnabledToggle = document.getElementById('smart-context-enabled');
    const sensitiveKeywordsContainer = document.getElementById('sensitive-keywords');
    const saveButton = document.getElementById('save-settings');
    const logEntriesContainer = document.getElementById('log-entries');
    const noLogsMessage = document.getElementById('no-logs');

    const DEFAULT_SETTINGS = {
        enabled: true,
        sensitiveWords: ["password", "credit", "card", "confidential", "secret", "ssn", "social security", "bank", "account", "routing", "salary", "compensation", "bonus", "stock", "fuck", "shit", "damn", "bitch", "asshole", "cunt", "motherfucker"],
        bannedTopics: [],
        prefixMatchingEnabled: true,
        synonymDetectionEnabled: true,
        smartContextEnabled: true,
    };

    function saveSettings() {
        const bannedTopics = bannedTopicsTextarea.value.split('\n').map(t => t.trim()).filter(Boolean);
        const settingsToSave = {
            enabled: enabledToggle.checked,
            bannedTopics,
            prefixMatchingEnabled: prefixMatchingEnabledToggle.checked,
            synonymDetectionEnabled: synonymDetectionEnabledToggle.checked,
            smartContextEnabled: smartContextEnabledToggle.checked,
            sensitiveWords: DEFAULT_SETTINGS.sensitiveWords // Always save the default list
        };

        chrome.storage.sync.set(settingsToSave, () => {
            console.log('Settings saved:', settingsToSave);
            // Send message to content script to update settings
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings: settingsToSave });
                }
            });
            // Give user feedback
            saveButton.textContent = 'Saved!';
            setTimeout(() => { saveButton.textContent = 'Save Settings'; }, 2000);
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
            enabledToggle.checked = result.enabled;
            bannedTopicsTextarea.value = result.bannedTopics.join('\n');
            prefixMatchingEnabledToggle.checked = result.prefixMatchingEnabled;
            synonymDetectionEnabledToggle.checked = result.synonymDetectionEnabled;
            smartContextEnabledToggle.checked = result.smartContextEnabled;
            
            DEFAULT_SETTINGS.sensitiveWords = result.sensitiveWords;

            // Populate sensitive keywords
            sensitiveKeywordsContainer.innerHTML = '';
            result.sensitiveWords.forEach(keyword => {
                const pill = document.createElement('div');
                pill.className = 'keyword-pill';
                pill.textContent = keyword;
                sensitiveKeywordsContainer.appendChild(pill);
            });
        });
    }

    function formatTimeAgo(timestamp) {
        const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    function loadMuteLog() {
        chrome.storage.local.get({ logs: [] }, (result) => {
            const logs = result.logs;
            if (logs.length === 0) {
                noLogsMessage.style.display = 'block';
                logEntriesContainer.style.display = 'none';
            } else {
                noLogsMessage.style.display = 'none';
                logEntriesContainer.style.display = 'block';
                logEntriesContainer.innerHTML = '';

                logs.slice().reverse().forEach(entry => {
                    const logElement = document.createElement('div');
                    logElement.className = 'log-entry';
                    logElement.innerHTML = `
                        <p>${entry.message}</p>
                        <div class="log-time">${formatTimeAgo(entry.timestamp)}</div>
                    `;
                    logEntriesContainer.appendChild(logElement);
                });
            }
        });
    }

    saveButton.addEventListener('click', saveSettings);

    loadSettings();
    loadMuteLog();
});
