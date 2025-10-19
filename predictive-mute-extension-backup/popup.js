document.addEventListener('DOMContentLoaded', () => {
    const sensitivitySlider = document.getElementById('sensitivity');
    const semanticModeToggle = document.getElementById('semanticMode');
    const resetButton = document.getElementById('reset-button');
    const logEntriesContainer = document.getElementById('log-entries');
    const noLogsMessage = document.getElementById('no-logs');

    const DEFAULT_SETTINGS = {
        sensitivity: 0.7,
        semanticMode: true,
    };

    // --- Settings Management --- //

    function saveSettings() {
        const settings = {
            sensitivity: parseFloat(sensitivitySlider.value),
            semanticMode: semanticModeToggle.checked,
        };
        chrome.storage.local.set({ settings });
    }

    function loadSettings() {
        chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
            const settings = result.settings;
            sensitivitySlider.value = settings.sensitivity;
            semanticModeToggle.checked = settings.semanticMode;
        });
    }

    // --- Mute Log Display --- //

    function formatTimeAgo(isoString) {
        const date = new Date(isoString);
        const seconds = Math.floor((new Date() - date) / 1000);
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
        chrome.storage.local.get({ muteLog: [] }, (result) => {
            const log = result.muteLog;
            if (log.length === 0) {
                noLogsMessage.style.display = 'block';
                logEntriesContainer.style.display = 'none';
            } else {
                noLogsMessage.style.display = 'none';
                logEntriesContainer.style.display = 'block';
                logEntriesContainer.innerHTML = ''; // Clear old logs

                log.forEach(entry => {
                    const logElement = document.createElement('div');
                    logElement.className = 'log-entry';
                    logElement.innerHTML = `
                        <p class="log-reason">“${entry.reason}”</p>
                        <p class="log-time">${formatTimeAgo(entry.timestamp)}</p>
                    `;
                    logEntriesContainer.appendChild(logElement);
                });
            }
        });
    }

    // --- Event Listeners --- //

    sensitivitySlider.addEventListener('input', saveSettings);
    semanticModeToggle.addEventListener('change', saveSettings);

    resetButton.addEventListener('click', () => {
        chrome.storage.local.set({ settings: DEFAULT_SETTINGS, muteLog: [] }, () => {
            loadSettings();
            loadMuteLog();
            console.log("Preferences and log have been reset.");
        });
    });

    // --- Initial Load --- //

    loadSettings();
    loadMuteLog();
});