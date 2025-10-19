// Check if running in Electron environment
//renderer js file for electron project
const isElectron = typeof require !== 'undefined' && require('electron');
const ipcRenderer = isElectron ? require('electron').ipcRenderer : null;
const remote = isElectron ? require('electron').remote : null;

// DOM Elements
const cancelBtn = document.getElementById('cancelBtn');
const continueBtn = document.getElementById('continueBtn');
const strictnessSlider = document.getElementById('strictnessSlider');
const strictnessValue = document.getElementById('strictnessValue');
const presetName = document.getElementById('presetName');
const presetButtons = document.querySelectorAll('.preset-btn');

// Whitelist/Blacklist Elements
const whitelistItems = document.getElementById('whitelistItems');
const blacklistItems = document.getElementById('blacklistItems');

// State
let isMonitoring = false;
let currentStrictnessLevel = 50;
let settings = {
  sensitivity: 3,
  keywords: [],
  autoMute: true
};

let whitelist = [];
let blacklist = [];

// Initialize
function init() {
  loadSettings();
  loadLists();
  setupEventListeners();
  
  // Load default preset
  loadPreset('1');
  
  // Add keyboard shortcut to show popup if hidden
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.popup-container').style.display === 'none') {
      document.querySelector('.popup-container').style.display = 'flex';
    }
  });
}

// Event Listeners
function setupEventListeners() {
  // Main controls
  cancelBtn.addEventListener('click', handleCancel);
  continueBtn.addEventListener('click', handleContinue);

  // Strictness Slider
  strictnessSlider.addEventListener('input', updateStrictnessDisplay);

  // Preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => selectPreset(btn.dataset.preset));
  });

  // Preset name editing
  presetName.addEventListener('blur', savePresetName);
  presetName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      presetName.blur(); // Trigger save
    }
  });
  presetName.addEventListener('input', () => {
    // Auto-save as user types (with debounce)
    clearTimeout(presetName.saveTimeout);
    presetName.saveTimeout = setTimeout(savePresetName, 500);
  });

  // Whitelist/Blacklist
  whitelistItems.addEventListener('input', () => saveListFromContent('whitelist'));
  blacklistItems.addEventListener('input', () => saveListFromContent('blacklist'));
  whitelistItems.addEventListener('keydown', (e) => handleListKeydown(e, 'whitelist'));
  blacklistItems.addEventListener('keydown', (e) => handleListKeydown(e, 'blacklist'));
}

// Handle Cancel
function handleCancel() {
  if (remote) {
    window.close();
  } else {
    // Browser fallback - hide the popup
    document.querySelector('.popup-container').style.display = 'none';
  }
}

// Handle Continue
function handleContinue() {
  // Save current settings and continue
  saveListFromContent('whitelist');
  saveListFromContent('blacklist');
  
  if (ipcRenderer) {
    ipcRenderer.send('continue-with-settings', { whitelist, blacklist, strictness: currentStrictnessLevel });
  }
  
  // Close the popup
  handleCancel();
}

// Select Preset
function selectPreset(presetId) {
  // Remove active class from all buttons
  presetButtons.forEach(btn => btn.classList.remove('active'));
  
  // Add active class to selected button
  document.querySelector(`[data-preset="${presetId}"]`).classList.add('active');
  
  // Load preset data
  loadPreset(presetId);
}

// Load Preset
function loadPreset(presetId) {
  const defaultPresets = {
    0: { name: 'Untitled #1', whitelist: [], blacklist: [], strictness: 50 },
    1: { name: 'Untitled #2', whitelist: [], blacklist: [], strictness: 50 },
    2: { name: 'Untitled #3', whitelist: [], blacklist: [], strictness: 50 },
    3: { name: 'Untitled #4', whitelist: [], blacklist: [], strictness: 50 },
    4: { name: 'Untitled #5', whitelist: [], blacklist: [], strictness: 50 }
  };
  
  const defaultPreset = defaultPresets[presetId];
  if (defaultPreset) {
    // Try to load saved name first, fallback to default
    const savedName = localStorage.getItem(`preset-${presetId}-name`);
    const presetName = savedName || defaultPreset.name;
    
    // Update the display
    document.getElementById('presetName').textContent = presetName;
    
    // Load saved data or use defaults
    const savedWhitelist = localStorage.getItem(`preset-${presetId}-whitelist`);
    const savedBlacklist = localStorage.getItem(`preset-${presetId}-blacklist`);
    const savedStrictness = localStorage.getItem(`preset-${presetId}-strictness`);
    
    whitelist = savedWhitelist ? JSON.parse(savedWhitelist) : defaultPreset.whitelist;
    blacklist = savedBlacklist ? JSON.parse(savedBlacklist) : defaultPreset.blacklist;
    currentStrictnessLevel = savedStrictness ? parseInt(savedStrictness) : defaultPreset.strictness;
    
    updateListDisplay('whitelist');
    updateListDisplay('blacklist');
    updateStrictnessLevel(currentStrictnessLevel);
    strictnessSlider.value = currentStrictnessLevel;
  }
}

// Save Preset Name
function savePresetName() {
  const newName = presetName.textContent.trim();
  if (newName) {
    // Get current preset ID
    const activeBtn = document.querySelector('.preset-btn.active');
    const currentPresetId = activeBtn ? activeBtn.dataset.preset : '0';
    
    // Save to localStorage with preset ID
    localStorage.setItem(`preset-${currentPresetId}-name`, newName);
    
    // Also save as current preset name
    localStorage.setItem('current-preset-name', newName);
    
    console.log(`Saved preset ${currentPresetId} name: ${newName}`);
  }
}

// Window Controls (duplicate event listeners removed - handled in setupEventListeners)

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
  if (ipcRenderer) {
    ipcRenderer.send('start-monitoring', settings);
  }

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

  // Reset strictness level
  updateStrictnessLevel(3);

  // Send to main process
  if (ipcRenderer) {
    ipcRenderer.send('stop-monitoring');
  }

  addLog('Stopped', 'info');
}

// Update Strictness Level
function updateStrictnessLevel(level) {
  currentStrictnessLevel = Math.max(0, Math.min(100, level));
  
  // Show descriptive text based on level
  let description;
  if (level <= 20) {
    description = 'Very Lenient';
  } else if (level <= 40) {
    description = 'Lenient';
  } else if (level <= 60) {
    description = 'Moderate';
  } else if (level <= 80) {
    description = 'Strict';
  } else {
    description = 'Very Strict';
  }
  
  strictnessValue.textContent = description;
}

// Add Transcription
function addTranscription(text, isFlagged = false) {
  const line = document.createElement('div');
  line.className = `transcript-line ${isFlagged ? 'flagged' : ''}`;
  line.textContent = text;
  transcriptBox.appendChild(line);
  transcriptBox.scrollTop = transcriptBox.scrollHeight;

  // Analyze text with whitelist/blacklist
  const analysis = analyzeText(text);
  if (analysis.hasWhitelist) {
    addLog(`Whitelist match: "${text.substring(0, 30)}..."`, 'info');
  }
  if (analysis.hasBlacklist) {
    addLog(`Blacklist match: "${text.substring(0, 30)}..."`, 'warning');
  }
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

// Strictness Slider
function updateStrictnessDisplay() {
  const value = parseInt(strictnessSlider.value);
  updateStrictnessLevel(value);
  
  // Save strictness level for current preset
  const activeBtn = document.querySelector('.preset-btn.active');
  const currentPresetId = activeBtn ? activeBtn.dataset.preset : '0';
  localStorage.setItem(`preset-${currentPresetId}-strictness`, value.toString());
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
  if (ipcRenderer) {
    ipcRenderer.send('update-sensitivity', settings.sensitivity);
  }
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
if (ipcRenderer) {
  ipcRenderer.on('monitoring-status', (event, data) => {
    addLog(`Status: ${data.status}`, 'info');
  });

ipcRenderer.on('strictness-level-update', (event, data) => {
  updateStrictnessLevel(data.level);
});

  ipcRenderer.on('transcription-update', (event, data) => {
    addTranscription(data.text, data.flagged);
  });
}

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
    // Update strictness based on danger level
    const strictnessLevel = Math.min(5, Math.max(1, Math.ceil(phrase.danger / 20)));
    updateStrictnessLevel(strictnessLevel);

    index++;

    if (index > 10) {
      clearInterval(interval);
      addLog('Demo complete', 'info');
    }
  }, 3000);
}

// Whitelist/Blacklist Management
function loadLists() {
  // Load whitelist
  const savedWhitelist = localStorage.getItem('takeback-whitelist');
  if (savedWhitelist) {
    whitelist = JSON.parse(savedWhitelist);
    updateListDisplay('whitelist');
  }

  // Load blacklist
  const savedBlacklist = localStorage.getItem('takeback-blacklist');
  if (savedBlacklist) {
    blacklist = JSON.parse(savedBlacklist);
    updateListDisplay('blacklist');
  }
}

function updateListDisplay(type) {
  const container = type === 'whitelist' ? whitelistItems : blacklistItems;
  const items = type === 'whitelist' ? whitelist : blacklist;
  
  container.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.textContent = `- ${item}`;
    container.appendChild(div);
  });
}

function saveListFromContent(type) {
  const container = type === 'whitelist' ? whitelistItems : blacklistItems;
  const items = Array.from(container.children)
    .map(item => item.textContent.replace(/^-\s*/, '').trim())
    .filter(item => item.length > 0);

  // Get current preset ID
  const activeBtn = document.querySelector('.preset-btn.active');
  const currentPresetId = activeBtn ? activeBtn.dataset.preset : '0';

  if (type === 'whitelist') {
    whitelist = items;
    localStorage.setItem('takeback-whitelist', JSON.stringify(whitelist));
    localStorage.setItem(`preset-${currentPresetId}-whitelist`, JSON.stringify(whitelist));
  } else {
    blacklist = items;
    localStorage.setItem('takeback-blacklist', JSON.stringify(blacklist));
    localStorage.setItem(`preset-${currentPresetId}-blacklist`, JSON.stringify(blacklist));
  }

  // Send to main process
  if (ipcRenderer) {
    ipcRenderer.send('update-lists', { whitelist, blacklist });
  }
}

function handleListKeydown(e, type) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const container = type === 'whitelist' ? whitelistItems : blacklistItems;
    const newItem = document.createElement('div');
    newItem.className = 'list-item';
    newItem.textContent = '- ';
    container.appendChild(newItem);
    
    // Focus the new item
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(newItem, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function editList(type) {
  // For now, just show a simple prompt - in a real app this would open a modal
  const currentItems = type === 'whitelist' ? whitelist : blacklist;
  const newItems = prompt(`Edit ${type} items (one per line):`, currentItems.join('\n'));
  
  if (newItems !== null) {
    const items = newItems
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (type === 'whitelist') {
      whitelist = items;
      localStorage.setItem('takeback-whitelist', JSON.stringify(whitelist));
      addLog(`Whitelist updated (${items.length} items)`, 'success');
    } else {
      blacklist = items;
      localStorage.setItem('takeback-blacklist', JSON.stringify(blacklist));
      addLog(`Blacklist updated (${items.length} items)`, 'success');
    }

    // Send to main process
    if (ipcRenderer) {
      ipcRenderer.send('update-lists', { whitelist, blacklist });
    }
  }
}

// Check if text contains whitelist/blacklist items
function analyzeText(text) {
  const lowerText = text.toLowerCase();
  
  // Check for whitelist items (reduce danger)
  let whitelistMatches = 0;
  whitelist.forEach(item => {
    if (lowerText.includes(item.toLowerCase())) {
      whitelistMatches++;
    }
  });

  // Check for blacklist items (increase danger)
  let blacklistMatches = 0;
  blacklist.forEach(item => {
    if (lowerText.includes(item.toLowerCase())) {
      blacklistMatches++;
    }
  });

  return {
    whitelistMatches,
    blacklistMatches,
    hasWhitelist: whitelistMatches > 0,
    hasBlacklist: blacklistMatches > 0
  };
}

// Initialize
init();
