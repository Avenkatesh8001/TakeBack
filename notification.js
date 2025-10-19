// Notification System for TakeBack
//functionality for notifications
class TakeBackNotification {
  constructor() {
    this.isVisible = false;
    this.currentTopic = '';
    this.transcriptVisible = false;
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    // Main elements
    this.overlay = document.querySelector('.notification-overlay');
    this.container = document.querySelector('.notification-container');
    this.notificationPanel = document.querySelector('.notification-panel');
    this.transcriptPanel = document.querySelector('.transcript-panel');
    
    // Message and content
    this.messageElement = document.getElementById('notificationMessage');
    this.transcriptContent = document.getElementById('transcriptContent');
    
    // Buttons
    this.addToWhitelistBtn = document.getElementById('addToWhitelistBtn');
    this.ignoreNowBtn = document.getElementById('ignoreNowBtn');
    this.ignoreCallBtn = document.getElementById('ignoreCallBtn');
    this.showTranscriptLink = document.getElementById('showTranscriptLink');
  }

  setupEventListeners() {
    // Button events
    this.addToWhitelistBtn.addEventListener('click', () => this.handleAddToWhitelist());
    this.ignoreNowBtn.addEventListener('click', () => this.handleIgnoreNow());
    this.ignoreCallBtn.addEventListener('click', () => this.handleIgnoreCall());
    this.showTranscriptLink.addEventListener('click', (e) => this.toggleTranscript(e));
    
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;
      
      switch(e.key) {
        case 'Escape':
          this.hide();
          break;
        case 'Enter':
          if (e.target === this.addToWhitelistBtn) {
            this.handleAddToWhitelist();
          }
          break;
      }
    });
  }

  // Show notification with different message types
  show(type = 'blacklisted', topic = '', transcript = '') {
    this.currentTopic = topic;
    this.isVisible = true;
    
    // Set message based on type
    const messages = {
      blacklisted: 'We automatically muted your microphone because you talked about a blacklisted topic.',
      nonWhitelisted: 'We noticed that you talked about a non-whitelisted topic. Do you want to whitelist it?',
      flagged: 'We detected potentially sensitive content in your conversation.'
    };
    
    this.messageElement.textContent = messages[type] || messages.blacklisted;
    
    // Update button text based on type
    if (type === 'nonWhitelisted') {
      this.addToWhitelistBtn.textContent = 'Add topic to whitelist';
    } else {
      this.addToWhitelistBtn.textContent = 'Add topic to whitelist';
    }
    
    // Set transcript content
    if (transcript) {
      this.setTranscriptContent(transcript);
    }
    
    // Show the notification
    this.overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus the primary button
    setTimeout(() => {
      this.addToWhitelistBtn.focus();
    }, 100);
  }

  // Hide notification
  hide() {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.container.classList.add('hide');
    
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.container.classList.remove('hide');
      this.hideTranscript();
      document.body.style.overflow = '';
    }, 300);
  }

  // Toggle transcript visibility
  toggleTranscript(e) {
    e.preventDefault();
    
    if (this.transcriptVisible) {
      this.hideTranscript();
    } else {
      this.showTranscript();
    }
  }

  showTranscript() {
    this.transcriptVisible = true;
    this.transcriptPanel.classList.add('show');
    this.showTranscriptLink.textContent = 'Hide transcript';
  }

  hideTranscript() {
    this.transcriptVisible = false;
    this.transcriptPanel.classList.remove('show');
    this.showTranscriptLink.textContent = 'Show transcript';
  }

  // Set transcript content
  setTranscriptContent(transcript) {
    if (typeof transcript === 'string') {
      // Simple text transcript
      this.transcriptContent.innerHTML = `<p class="transcript-line">${transcript}</p>`;
    } else if (Array.isArray(transcript)) {
      // Array of transcript lines
      this.transcriptContent.innerHTML = transcript.map(line => {
        const className = line.flagged ? 'transcript-line flagged' : 'transcript-line';
        return `<p class="${className}">${line.text}</p>`;
      }).join('');
    }
  }

  // Event handlers
  handleAddToWhitelist() {
    console.log('Adding topic to whitelist:', this.currentTopic);
    
    // Send to backend
    this.sendToBackend('add-to-whitelist', {
      topic: this.currentTopic,
      timestamp: new Date().toISOString()
    });
    
    // Show success feedback
    this.showFeedback('Topic added to whitelist');
    this.hide();
  }

  handleIgnoreNow() {
    console.log('Ignoring for now:', this.currentTopic);
    
    // Send to backend
    this.sendToBackend('ignore-now', {
      topic: this.currentTopic,
      timestamp: new Date().toISOString()
    });
    
    this.hide();
  }

  handleIgnoreCall() {
    console.log('Ignoring for this call:', this.currentTopic);
    
    // Send to backend
    this.sendToBackend('ignore-call', {
      topic: this.currentTopic,
      timestamp: new Date().toISOString()
    });
    
    this.hide();
  }

  // Send data to backend
  // TODO: Replace this method with your actual backend API calls
  // See INTEGRATION_GUIDE.md and BACKEND_EXAMPLES.md for implementation examples
  sendToBackend(action, data) {
    // Option 1: PostMessage to parent window (for iframe integration)
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({
        type: 'takeback-notification',
        action: action,
        data: data
      }, '*');
    }
    
    // Option 2: Direct API call to your backend
    // Uncomment and modify the following code for your backend:
    /*
    fetch('/api/takeback/notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken(), // Add your auth method
        'X-CSRF-Token': getCSRFToken() // Add CSRF protection if needed
      },
      body: JSON.stringify({ action, data })
    })
    .then(response => response.json())
    .then(result => {
      if (!result.success) {
        console.error('Backend error:', result.message);
        this.showFeedback('Error: ' + result.message);
      }
    })
    .catch(error => {
      console.error('Network error:', error);
      this.showFeedback('Network error occurred');
    });
    */
    
    // Option 3: WebSocket communication
    // Uncomment if using WebSocket:
    /*
    if (window.takebackWebSocket && window.takebackWebSocket.readyState === WebSocket.OPEN) {
      window.takebackWebSocket.send(JSON.stringify({ action, data }));
    }
    */
  }

  // Show feedback message
  showFeedback(message) {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = 'feedback-message';
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #8b5cf6;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.remove();
    }, 3000);
  }

  // Public API methods
  showBlacklistedTopic(topic, transcript) {
    this.show('blacklisted', topic, transcript);
  }

  showNonWhitelistedTopic(topic, transcript) {
    this.show('nonWhitelisted', topic, transcript);
  }

  showFlaggedContent(topic, transcript) {
    this.show('flagged', topic, transcript);
  }
}

// Initialize notification system
const notification = new TakeBackNotification();

// Example usage functions (for testing)
function showExampleNotification() {
  const transcript = [
    { text: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam', flagged: false },
    { text: 'nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam', flagged: false },
    { text: 'erat volutpat. Ut wisi enim ad minim veniam, quis nostrud', flagged: false },
    { text: 'adipiscing elit, sed diam', flagged: true },
    { text: 'exerci tation ullamcorper suscipit lobortis nisl ut aliquip', flagged: false }
  ];
  
  notification.showBlacklistedTopic('confidential information', transcript);
}

// Auto-show example on load (for testing)
// Uncomment the line below to test the notification
// setTimeout(showExampleNotification, 1000);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TakeBackNotification;
}

// Global instance for easy access
window.TakeBackNotification = TakeBackNotification;
window.takebackNotification = notification;
