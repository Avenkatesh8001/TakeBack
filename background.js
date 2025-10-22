// Background Service Worker for TakeBack Extension
//background
// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startMonitoring':
      startMonitoring(request.preset, request.strength);
      break;
      
    case 'stopMonitoring':
      stopMonitoring();
      break;
      
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      break;
      //did some stuff here
    case 'showNotification':
      showNotification(request.message, request.options);
      break;
  }
});

// Start monitoring function
function startMonitoring(preset, strength) {
  console.log('Starting monitoring with preset:', preset.name, 'strength:', strength);
  
  // Set monitoring state
  chrome.storage.local.set({ 
    isMonitoring: true,
    currentPreset: preset,
    strength: strength
  });
  
  // Notify content scripts to start monitoring
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startMonitoring',
        preset: preset,
        strength: strength
      });
    }
  });
}

// Stop monitoring function
function stopMonitoring() {
  console.log('Stopping monitoring');
  
  // Clear monitoring state
  chrome.storage.local.set({ 
    isMonitoring: false,
    currentPreset: null,
    strength: null
  });
  
  // Notify content scripts to stop monitoring
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopMonitoring'
      });
    }
  });
}

// Show notification
function showNotification(message, options = {}) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'TakeBack',
    message: message,
    ...options
  });
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a supported meeting platform
    const supportedPlatforms = [
      'meet.google.com',
      'zoom.us',
      'teams.microsoft.com'
    ];
    
    const isSupported = supportedPlatforms.some(platform => 
      tab.url.includes(platform)
    );
    
    if (isSupported) {
      // Inject content script if needed
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(() => {
        // Script already injected or failed
      });
    }
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      presets: {
        0: { name: 'Default', whitelist: [], blacklist: [] },
        1: { name: 'External Supplier', whitelist: ['weekly progress', 'updating deadlines'], blacklist: ['What material my project is made of', 'Anything about my involvement in Project X'] },
        2: { name: 'Internal Team', whitelist: [], blacklist: [] },
        3: { name: 'Client Meeting', whitelist: [], blacklist: [] },
        4: { name: 'Custom', whitelist: [], blacklist: [] }
      },
      currentPreset: 1,
      strength: 60
    });
  }
});
