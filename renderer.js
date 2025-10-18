const { ipcRenderer } = require('electron');
const { remote } = require('electron');

// DOM Elements
const closeBtn = document.getElementById('closeBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const dangerBar = document.getElementById('dangerBar');
const dangerValue = document.getElementById('dangerValue');
const transcriptBox = document.getElementById('transcriptBox');
const logBox = document.getElementById('logBox');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityValue = document.getElementById('sensitivityValue');
const confidentialKeywords = document.getElementById('confidentialKeywords');
const autoMute = document.getElementById('autoMute');
const saveSettings = document.getElementById('saveSettings');
const settingsToggle = document.getElementById('settingsToggle');
const settingsContent = document.getElementById('settingsContent');

// State
let isMonitoring = false;
let currentDangerLevel = 0;
let settings = {
  sensitivity: 3,
  keywords: [],
  autoMute: true
};

// Initialize
function init() {
  loadSettings();
  setupEventListeners();
  addLog('Ready', 'info');
}

// Event Listeners
function setupEventListeners() {
  // Window controls
  closeBtn.addEventListener('click', () => {
    window.close();
  });

  minimizeBtn.addEventListener('click', () => {
    const window = require('electron').remote.getCurrentWindow();
    window.minimize();
  });

  // Main controls
  startBtn.addEventListener('click', startMonitoring);
  stopBtn.addEventListener('click', stopMonitoring);

  // Settings
  sensitivitySlider.addEventListener('input', updateSensitivityDisplay);
  saveSettings.addEventListener('click', handleSaveSettings);
  settingsToggle.addEventListener('click', toggleSettings);
}

// Toggle Settings Panel
function toggleSettings() {
  const icon = settingsToggle.querySelector('.toggle-icon');
  settingsContent.classList.toggle('open');
  icon.classList.toggle('open');
}

// Window Controls
closeBtn.addEventListener('click', () => {
  const window = require('electron').remote.getCurrentWindow();
  window.close();
});

minimizeBtn.addEventListener('click', () => {
  const window = require('electron').remote.getCurrentWindow();
  window.minimize();
});

// Start Monitoring
function startMonitoring() {
  isMonitoring = true;

  // Update UI
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusDot.classList.add('active');
  statusText.textContent = 'Monitoring';

  // Clear placeholder
  transcriptBox.innerHTML = '';

  // Send to main process
  ipcRenderer.send('start-monitoring', settings);

  addLog('Monitoring started', 'success');

  // Simulate monitoring
  simulateMonitoring();
}

// Stop Monitoring
function stopMonitoring() {
  isMonitoring = false;

  // Update UI
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusDot.classList.remove('active');
  statusDot.classList.remove('danger');
  statusText.textContent = 'Inactive';

  // Reset danger level
  updateDangerLevel(0);

  // Send to main process
  ipcRenderer.send('stop-monitoring');

  addLog('Stopped', 'info');
}

// Update Danger Level
function updateDangerLevel(level) {
  currentDangerLevel = Math.max(0, Math.min(100, level));
  dangerBar.style.width = `${currentDangerLevel}%`;
  dangerValue.textContent = currentDangerLevel;

  // Update status indicator
  if (currentDangerLevel > 70) {
    statusDot.classList.add('danger');
    statusDot.classList.remove('active');
    addLog(`DANGER: ${currentDangerLevel}%`, 'danger');

    if (settings.autoMute) {
      addLog('Auto-muted', 'warning');
    }
  } else if (currentDangerLevel > 40) {
    statusDot.classList.remove('danger');
    statusDot.classList.add('active');
  } else {
    statusDot.classList.remove('danger');
    if (isMonitoring) {
      statusDot.classList.add('active');
    }
  }
}

// Add Transcription
function addTranscription(text, isFlagged = false) {
  const line = document.createElement('div');
  line.className = `transcript-line ${isFlagged ? 'flagged' : ''}`;
  line.textContent = text;
  transcriptBox.appendChild(line);
  transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

// Add Log Entry
function addLog(message, type = 'info') {
  const entry = document.createElement('p');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  entry.textContent = `[${timestamp}] ${message}`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;

  // Keep only last 50 entries
  while (logBox.children.length > 50) {
    logBox.removeChild(logBox.firstChild);
  }
}

// Sensitivity Slider
function updateSensitivityDisplay() {
  const value = parseInt(sensitivitySlider.value);
  sensitivityValue.textContent = value;
}

// Save Settings
function handleSaveSettings() {
  settings.sensitivity = parseInt(sensitivitySlider.value);
  settings.keywords = confidentialKeywords.value
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
  settings.autoMute = autoMute.checked;

  localStorage.setItem('takeback-settings', JSON.stringify(settings));

  addLog('Settings saved', 'success');
  ipcRenderer.send('update-sensitivity', settings.sensitivity);
}

// Load Settings
function loadSettings() {
  const saved = localStorage.getItem('takeback-settings');
  if (saved) {
    settings = JSON.parse(saved);
    sensitivitySlider.value = settings.sensitivity;
    updateSensitivityDisplay();
    confidentialKeywords.value = settings.keywords.join(', ');
    autoMute.checked = settings.autoMute;
  }
}

// IPC Listeners
ipcRenderer.on('monitoring-status', (event, data) => {
  addLog(`Status: ${data.status}`, 'info');
});

ipcRenderer.on('danger-level-update', (event, data) => {
  updateDangerLevel(data.level);
});

ipcRenderer.on('transcription-update', (event, data) => {
  addTranscription(data.text, data.flagged);
});

// Demo Simulation
function simulateMonitoring() {
  if (!isMonitoring) return;

  const samplePhrases = [
    { text: "Hey everyone, how's it going?", danger: 5 },
    { text: "Let me share my screen", danger: 10 },
    { text: "Our Q4 revenue is up", danger: 45 },
    { text: "The API key is in config", danger: 85 },
    { text: "I'll send the password", danger: 95 },
    { text: "Thanks for joining", danger: 5 }
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (!isMonitoring) {
      clearInterval(interval);
      return;
    }

    const phrase = samplePhrases[index % samplePhrases.length];
    addTranscription(phrase.text, phrase.danger > 70);
    updateDangerLevel(phrase.danger);

    index++;

    if (index > 10) {
      clearInterval(interval);
      addLog('Demo complete', 'info');
    }
  }, 3000);
}

// Initialize
init();
