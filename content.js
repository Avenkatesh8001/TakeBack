// Content Script for TakeBack Extension
//main content scripts
let isMonitoring = false;
let currentPreset = null;
let strength = 60;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startMonitoring':
      startMonitoring(request.preset, request.strength);
      break;
      
    case 'stopMonitoring':
      stopMonitoring();
      break;
  }
});

// Start monitoring
function startMonitoring(preset, strengthLevel) {
  isMonitoring = true;
  currentPreset = preset;
  strength = strengthLevel;
  
  console.log('Content script: Starting monitoring');
  
  // Set up audio monitoring (placeholder)
  setupAudioMonitoring();
  
  // Set up UI indicators
  addMonitoringIndicator();
}

// Stop monitoring
function stopMonitoring() {
  isMonitoring = false;
  currentPreset = null;
  strength = 60;
  
  console.log('Content script: Stopping monitoring');
  
  // Remove UI indicators
  removeMonitoringIndicator();
}

// Setup audio monitoring (placeholder)
function setupAudioMonitoring() {
  // This would integrate with WebRTC APIs to monitor audio
  // For now, we'll simulate with a timer
  
  if (isMonitoring) {
    // Simulate monitoring every 5 seconds
    setTimeout(() => {
      if (isMonitoring) {
        simulateAudioAnalysis();
        setupAudioMonitoring(); // Continue monitoring
      }
    }, 5000);
  }
}

// Simulate audio analysis
function simulateAudioAnalysis() {
  // Simulate detecting blacklisted content
  const random = Math.random();
  if (random < 0.1) { // 10% chance of triggering
    const blacklistedPhrase = currentPreset.blacklist[Math.floor(Math.random() * currentPreset.blacklist.length)];
    triggerBlacklistAlert(blacklistedPhrase);
  }
}

// Trigger blacklist alert
function triggerBlacklistAlert(phrase) {
  console.log('Blacklist triggered:', phrase);
  
  // Send message to background script to show notification
  chrome.runtime.sendMessage({
    action: 'showNotification',
    message: `Detected blacklisted content: "${phrase}"`,
    options: {
      type: 'basic',
      priority: 2
    }
  });
  
  // Show in-page notification
  showInPageNotification(phrase);
}

// Show in-page notification
function showInPageNotification(phrase) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'takeback-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">⚠️</div>
      <div class="notification-message">
        We detected you mentioned: "${phrase}"
      </div>
      <div class="notification-actions">
        <button class="btn-add-whitelist">Add to Whitelist</button>
        <button class="btn-ignore">Ignore</button>
      </div>
    </div>
  `;
  
  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2d2d2d;
    color: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
  
  // Add button event listeners
  const addWhitelistBtn = notification.querySelector('.btn-add-whitelist');
  const ignoreBtn = notification.querySelector('.btn-ignore');
  
  addWhitelistBtn.addEventListener('click', () => {
    // Add to whitelist logic
    chrome.runtime.sendMessage({
      action: 'addToWhitelist',
      phrase: phrase
    });
    notification.remove();
  });
  
  ignoreBtn.addEventListener('click', () => {
    notification.remove();
  });
}

// Add monitoring indicator
function addMonitoringIndicator() {
  // Check if indicator already exists
  if (document.querySelector('.takeback-indicator')) {
    return;
  }
  
  const indicator = document.createElement('div');
  indicator.className = 'takeback-indicator';
  indicator.innerHTML = `
    <div class="indicator-content">
      <div class="indicator-dot"></div>
      <span>TakeBack Active</span>
    </div>
  `;
  
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(139, 92, 246, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  // Add pulsing dot
  const dot = indicator.querySelector('.indicator-dot');
  dot.style.cssText = `
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    animation: pulse 2s infinite;
  `;
  
  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
}

// Remove monitoring indicator
function removeMonitoringIndicator() {
  const indicator = document.querySelector('.takeback-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Initialize content script
console.log('TakeBack content script loaded');
