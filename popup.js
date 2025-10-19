// Extension Popup JavaScript
//functionality for popup
// DOM Elements
const presetButtons = document.querySelectorAll('.preset-btn');
const presetName = document.getElementById('presetName');
const whitelistTextarea = document.getElementById('whitelistTextarea');
const blacklistTextarea = document.getElementById('blacklistTextarea');
const strengthSlider = document.getElementById('strengthSlider');
const strengthValue = document.getElementById('strengthValue');
const cancelBtn = document.getElementById('cancelBtn');
const continueBtn = document.getElementById('continueBtn');

// State
let currentPreset = 0;
let presets = {
  0: { name: 'Untitled #1', whitelist: [], blacklist: [] },
  1: { name: 'Untitled #2', whitelist: [], blacklist: [] },
  2: { name: 'Untitled #3', whitelist: [], blacklist: [] },
  3: { name: 'Untitled #4', whitelist: [], blacklist: [] },
  4: { name: 'Untitled #5', whitelist: [], blacklist: [] }
};

// Strength levels
const strengthLevels = [
  'Very Lenient',
  'Lenient', 
  'Moderately Strict',
  'Strict',
  'Very Strict'
];

// Initialize
function init() {
  loadPresets();
  setupEventListeners();
  updateUI();
}

// Load presets from storage
async function loadPresets() {
  try {
    const result = await chrome.storage.sync.get(['presets', 'currentPreset']);
    if (result.presets) {
      presets = { ...presets, ...result.presets };
    }
    if (result.currentPreset !== undefined) {
      currentPreset = result.currentPreset;
    }
  } catch (error) {
    console.log('Using default presets');
  }
}

// Save presets to storage
async function savePresets() {
  try {
    await chrome.storage.sync.set({ 
      presets: presets,
      currentPreset: currentPreset 
    });
  } catch (error) {
    console.error('Failed to save presets:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetId = parseInt(btn.dataset.preset);
      selectPreset(presetId);
    });
  });

  // Preset name editing
  presetName.addEventListener('blur', savePresetName);
  presetName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      presetName.blur();
    }
  });

  // Textarea change handlers
  whitelistTextarea.addEventListener('input', () => saveListContent('whitelist'));
  blacklistTextarea.addEventListener('input', () => saveListContent('blacklist'));

  // Strength slider
  strengthSlider.addEventListener('input', updateStrength);

  // Footer buttons
  cancelBtn.addEventListener('click', cancel);
  continueBtn.addEventListener('click', continueAction);
}


// Select preset
function selectPreset(presetId) {
  currentPreset = presetId;
  
  // Update active button
  presetButtons.forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.dataset.preset) === presetId) {
      btn.classList.add('active');
    }
  });
  
  // Update preset name
  presetName.textContent = presets[presetId].name;
  
  // Update content
  updateContent();
  
  // Save to storage
  savePresets();
}

// Save preset name
function savePresetName() {
  const newName = presetName.textContent.trim();
  if (newName && newName !== presets[currentPreset].name) {
    presets[currentPreset].name = newName;
    savePresets();
  }
}

// Update content based on current preset
function updateContent() {
  const preset = presets[currentPreset];
  
  // Update whitelist textarea
  whitelistTextarea.value = preset.whitelist.join('\n');
  
  // Update blacklist textarea
  blacklistTextarea.value = preset.blacklist.join('\n');
}


// Save list content
function saveListContent(type) {
  const textarea = type === 'whitelist' ? whitelistTextarea : blacklistTextarea;
  const items = textarea.value
    .split('\n')
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  if (type === 'whitelist') {
    presets[currentPreset].whitelist = items;
  } else {
    presets[currentPreset].blacklist = items;
  }
  
  savePresets();
}

// Update strength
function updateStrength() {
  const value = parseInt(strengthSlider.value);
  const level = Math.floor((value / 100) * (strengthLevels.length - 1));
  strengthValue.textContent = strengthLevels[level];
  
  // Save strength setting
  chrome.storage.sync.set({ strength: value });
}


// Cancel action
function cancel() {
  // Close the popup
  window.close();
}

// Continue action
function continueAction() {
  // Send message to background script to start monitoring
  chrome.runtime.sendMessage({ 
    action: 'startMonitoring',
    preset: presets[currentPreset],
    strength: parseInt(strengthSlider.value)
  });
  
  // Close the popup
  window.close();
}

// Update UI
function updateUI() {
  // Set active preset button
  presetButtons.forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.dataset.preset) === currentPreset) {
      btn.classList.add('active');
    }
  });
  
  // Set preset name
  presetName.textContent = presets[currentPreset].name;
  
  // Update content
  updateContent();
  
  // Load strength setting
  chrome.storage.sync.get(['strength'], (result) => {
    if (result.strength !== undefined) {
      strengthSlider.value = result.strength;
      updateStrength();
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
