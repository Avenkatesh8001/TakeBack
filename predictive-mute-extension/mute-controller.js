// Centralized mute controller with state machine
// States: IDLE → LISTENING → PREDICTED → MUTED → RECOVERING → IDLE

(function() {
  'use strict';

  // State machine states
  const States = {
    IDLE: 'IDLE',               // Not monitoring
    LISTENING: 'LISTENING',     // Actively listening for speech
    PREDICTED: 'PREDICTED',     // Risk detected, preparing to mute
    MUTED: 'MUTED',            // Mic is muted
    RECOVERING: 'RECOVERING'    // Cooldown period after unmute
  };

  // Mute controller singleton
  class MuteController {
    constructor() {
      this.state = States.IDLE;
      this.audioTracks = [];
      this.lastMuteTime = 0;
      this.lastAlertTime = 0;
      this.muteActive = false;
      this.predictionBuffer = [];
      this.stateChangeListeners = [];

      // Configuration
      this.MUTE_COOLDOWN = 2000;      // 2 seconds after unmute
      this.ALERT_COOLDOWN = 2000;     // 2 seconds between alerts
      this.PREDICTION_BUFFER = 350;   // 350ms buffer before mute
      this.RECOVERY_DURATION = 1000;  // 1 second recovery period
    }

    // Add state change listener
    onStateChange(callback) {
      this.stateChangeListeners.push(callback);
    }

    // Notify state change
    notifyStateChange(oldState, newState, reason) {
      console.log(`[MuteController] State: ${oldState} → ${newState} (${reason})`);
      this.stateChangeListeners.forEach(cb => {
        try {
          cb(newState, oldState, reason);
        } catch (err) {
          console.error('[MuteController] State listener error:', err);
        }
      });
    }

    // Transition to new state
    setState(newState, reason = '') {
      const oldState = this.state;
      if (oldState !== newState) {
        this.state = newState;
        this.notifyStateChange(oldState, newState, reason);
      }
    }

    // Check if currently muted
    isMuted() {
      return this.state === States.MUTED;
    }

    // Check if can mute (not in cooldown)
    canMute() {
      const now = Date.now();

      // Already muted
      if (this.state === States.MUTED) {
        return false;
      }

      // In recovery/cooldown period
      if (this.state === States.RECOVERING) {
        return false;
      }

      // Too soon after last mute
      if (now - this.lastMuteTime < this.MUTE_COOLDOWN) {
        return false;
      }

      return true;
    }

    // Check if can show alert (not spamming)
    canShowAlert() {
      const now = Date.now();

      // Already showing alert recently
      if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
        return false;
      }

      // Don't spam while muted
      if (this.state === States.MUTED) {
        return false;
      }

      return true;
    }

    // Predict risk (enter buffer period)
    async predictRisk(detectionResult, textChunk, confidence) {
      if (!this.canMute()) {
        console.log('[MuteController] Cannot mute (cooldown or already muted)');
        return false;
      }

      this.setState(States.PREDICTED, `risk detected: ${detectionResult.concept || 'keyword'}`);

      // Store prediction
      this.predictionBuffer.push({
        result: detectionResult,
        text: textChunk,
        confidence: confidence,
        timestamp: Date.now()
      });

      // Wait for prediction buffer (250-400ms)
      await new Promise(resolve => setTimeout(resolve, this.PREDICTION_BUFFER));

      // Check if still should mute (user might have stopped speaking)
      if (this.state === States.PREDICTED && this.canMute()) {
        return this.executeMute(detectionResult, textChunk);
      }

      // Prediction expired, return to listening
      this.setState(States.LISTENING, 'prediction expired');
      return false;
    }

    // Execute actual mute
    executeMute(detectionResult, textChunk) {
      console.log('[MuteController] Executing mute for:', textChunk);

      // Find and mute all audio tracks
      let mutedCount = 0;
      this.audioTracks = this.findAudioTracks();

      this.audioTracks.forEach(track => {
        if (track.enabled) {
          track.enabled = false;
          mutedCount++;
        }
      });

      if (mutedCount > 0) {
        this.setState(States.MUTED, `muted ${mutedCount} track(s)`);
        this.lastMuteTime = Date.now();
        this.muteActive = true;

        // Show alert if allowed
        if (this.canShowAlert()) {
          this.showAlert(detectionResult, textChunk);
          this.lastAlertTime = Date.now();
        }

        // Monitor for manual unmute
        this.startUnmuteMonitoring();

        return true;
      } else {
        console.warn('[MuteController] No audio tracks found to mute');
        this.setState(States.LISTENING, 'no tracks to mute');
        return false;
      }
    }

    // Find all active audio tracks
    findAudioTracks() {
      const tracks = [];

      // Get all media streams from the page
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach(el => {
        if (el.srcObject && el.srcObject.getAudioTracks) {
          tracks.push(...el.srcObject.getAudioTracks());
        }
      });

      // Try to get user media tracks (if accessible)
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Tracks will be found dynamically
      }

      console.log('[MuteController] Found', tracks.length, 'audio tracks');
      return tracks;
    }

    // Monitor for manual unmute
    startUnmuteMonitoring() {
      const checkInterval = 500;
      const maxDuration = 300000; // 5 minutes max
      let elapsed = 0;

      const checkUnmute = () => {
        if (this.state !== States.MUTED) {
          return; // Already unmuted
        }

        elapsed += checkInterval;
        if (elapsed > maxDuration) {
          console.log('[MuteController] Max mute duration reached, auto-recovering');
          this.handleUnmute();
          return;
        }

        // Check if user manually unmuted
        const currentlyMuted = this.audioTracks.every(track => !track.enabled);
        if (!currentlyMuted) {
          console.log('[MuteController] Manual unmute detected');
          this.handleUnmute();
          return;
        }

        // Continue monitoring
        setTimeout(checkUnmute, checkInterval);
      };

      setTimeout(checkUnmute, checkInterval);
    }

    // Handle unmute (manual or automatic)
    handleUnmute() {
      if (this.state === States.MUTED) {
        this.setState(States.RECOVERING, 'unmuted, entering cooldown');
        this.muteActive = false;
        this.predictionBuffer = [];

        // Enter recovery period
        setTimeout(() => {
          if (this.state === States.RECOVERING) {
            this.setState(States.LISTENING, 'recovery complete');
          }
        }, this.RECOVERY_DURATION);
      }
    }

    // Start listening
    startListening() {
      if (this.state === States.IDLE) {
        this.setState(States.LISTENING, 'monitoring started');
      }
    }

    // Stop listening
    stopListening() {
      this.setState(States.IDLE, 'monitoring stopped');
      this.predictionBuffer = [];
      this.muteActive = false;
    }

    // Show alert (delegated to content script)
    showAlert(detectionResult, textChunk) {
      // Dispatch custom event for UI to handle
      const event = new CustomEvent('predictivemute:alert', {
        detail: {
          result: detectionResult,
          text: textChunk,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Get current state
    getState() {
      return this.state;
    }

    // Get state color for UI
    getStateColor() {
      switch (this.state) {
        case States.IDLE:
          return 'gray';
        case States.LISTENING:
          return 'green';
        case States.PREDICTED:
          return 'amber';
        case States.MUTED:
          return 'red';
        case States.RECOVERING:
          return 'orange';
        default:
          return 'gray';
      }
    }

    // Reset controller
    reset() {
      this.state = States.IDLE;
      this.audioTracks = [];
      this.predictionBuffer = [];
      this.muteActive = false;
      console.log('[MuteController] Reset complete');
    }
  }

  // Export singleton instance
  window.MuteController = new MuteController();
  window.MuteStates = States;

  console.log('[MuteController] Module loaded');
})();
