// Fixed Mute Controller - Actually works on Google Meet/Zoom
(function() {
  'use strict';

  const States = {
    IDLE: 'IDLE',
    LISTENING: 'LISTENING',
    PREDICTED: 'PREDICTED',
    MUTED: 'MUTED',
    RECOVERING: 'RECOVERING'
  };

  class MuteController {
    constructor() {
      this.state = States.IDLE;
      this.lastMuteTime = 0;
      this.lastAlertTime = 0;
      this.stateChangeListeners = [];

      // Config
      this.MUTE_COOLDOWN = 2000;
      this.ALERT_COOLDOWN = 2000;
      this.PREDICTION_BUFFER = 350;
      this.RECOVERY_DURATION = 1000;
    }

    onStateChange(callback) {
      this.stateChangeListeners.push(callback);
    }

    notifyStateChange(oldState, newState, reason) {
      console.log(`[MuteController] ${oldState} → ${newState} (${reason})`);
      this.stateChangeListeners.forEach(cb => {
        try {
          cb(newState, oldState, reason);
        } catch (err) {
          console.error('[MuteController] Listener error:', err);
        }
      });
    }

    setState(newState, reason = '') {
      const oldState = this.state;
      if (oldState !== newState) {
        this.state = newState;
        this.notifyStateChange(oldState, newState, reason);
      }
    }

    isMuted() {
      return this.state === States.MUTED;
    }

    canMute() {
      const now = Date.now();
      if (this.state === States.MUTED || this.state === States.RECOVERING) {
        return false;
      }
      if (now - this.lastMuteTime < this.MUTE_COOLDOWN) {
        return false;
      }
      return true;
    }

    canShowAlert() {
      const now = Date.now();
      if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
        return false;
      }
      if (this.state === States.MUTED) {
        return false;
      }
      return true;
    }

    async predictRisk(detectionResult, textChunk, confidence) {
      if (!this.canMute()) {
        console.log('[MuteController] Cannot mute (cooldown)');
        return false;
      }

      this.setState(States.PREDICTED, 'risk detected');

      await new Promise(resolve => setTimeout(resolve, this.PREDICTION_BUFFER));

      if (this.state === States.PREDICTED && this.canMute()) {
        return this.executeMute(detectionResult, textChunk);
      }

      this.setState(States.LISTENING, 'prediction expired');
      return false;
    }

    executeMute(detectionResult, textChunk) {
      console.log('[MuteController] Executing mute for:', textChunk);

      // Try multiple methods to mute
      let muted = false;

      // Method 1: Click Google Meet mute button
      const meetMuteBtn = document.querySelector('[data-is-muted="false"]') ||
                          document.querySelector('[aria-label*="microphone" i][aria-label*="turn off" i]') ||
                          document.querySelector('[aria-label*="mute" i]:not([aria-label*="unmute" i])');

      if (meetMuteBtn) {
        meetMuteBtn.click();
        muted = true;
        console.log('[MuteController] Clicked Google Meet mute button');
      }

      // Method 2: Click Zoom mute button
      const zoomMuteBtn = document.querySelector('.audio-mute-btn') ||
                          document.querySelector('[aria-label*="Mute audio"]');

      if (zoomMuteBtn && !muted) {
        zoomMuteBtn.click();
        muted = true;
        console.log('[MuteController] Clicked Zoom mute button');
      }

      // Method 3: Find and disable audio tracks directly
      if (!muted) {
        const audioTracks = this.findAllAudioTracks();
        audioTracks.forEach(track => {
          if (track.enabled) {
            track.enabled = false;
            muted = true;
          }
        });
        if (muted) {
          console.log('[MuteController] Disabled audio tracks directly');
        }
      }

      if (muted) {
        this.setState(States.MUTED, 'mic muted');
        this.lastMuteTime = Date.now();

        if (this.canShowAlert()) {
          this.showAlert(detectionResult, textChunk);
          this.lastAlertTime = Date.now();
        }

        this.startUnmuteMonitoring();
        return true;
      } else {
        console.warn('[MuteController] Failed to mute');
        this.setState(States.LISTENING, 'mute failed');
        return false;
      }
    }

    findAllAudioTracks() {
      const tracks = [];

      // Get tracks from media elements
      document.querySelectorAll('audio, video').forEach(el => {
        if (el.srcObject && el.srcObject.getAudioTracks) {
          tracks.push(...el.srcObject.getAudioTracks());
        }
      });

      return tracks;
    }

    startUnmuteMonitoring() {
      const checkInterval = 500;
      let checks = 0;
      const maxChecks = 600; // 5 minutes

      const checkUnmute = () => {
        if (this.state !== States.MUTED) {
          return;
        }

        checks++;
        if (checks > maxChecks) {
          console.log('[MuteController] Max monitoring duration reached');
          this.handleUnmute();
          return;
        }

        // Check if manually unmuted (Google Meet)
        const meetUnmuteBtn = document.querySelector('[data-is-muted="true"]') ||
                              document.querySelector('[aria-label*="microphone" i][aria-label*="turn on" i]');

        if (meetUnmuteBtn) {
          console.log('[MuteController] Detected manual unmute');
          this.handleUnmute();
          return;
        }

        // Check audio tracks
        const audioTracks = this.findAllAudioTracks();
        const anyEnabled = audioTracks.some(track => track.enabled);

        if (anyEnabled) {
          console.log('[MuteController] Audio tracks re-enabled');
          this.handleUnmute();
          return;
        }

        setTimeout(checkUnmute, checkInterval);
      };

      setTimeout(checkUnmute, checkInterval);
    }

    handleUnmute() {
      if (this.state === States.MUTED) {
        this.setState(States.RECOVERING, 'unmuted');

        setTimeout(() => {
          if (this.state === States.RECOVERING) {
            this.setState(States.LISTENING, 'recovery complete');
          }
        }, this.RECOVERY_DURATION);
      }
    }

    startListening() {
      if (this.state === States.IDLE) {
        this.setState(States.LISTENING, 'started');
      }
    }

    stopListening() {
      this.setState(States.IDLE, 'stopped');
    }

    showAlert(detectionResult, textChunk) {
      const event = new CustomEvent('predictivemute:alert', {
        detail: {
          result: detectionResult,
          text: textChunk,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    getState() {
      return this.state;
    }

    getStateColor() {
      switch (this.state) {
        case States.IDLE: return 'gray';
        case States.LISTENING: return 'green';
        case States.PREDICTED: return 'amber';
        case States.MUTED: return 'red';
        case States.RECOVERING: return 'orange';
        default: return 'gray';
      }
    }

    reset() {
      this.state = States.IDLE;
      console.log('[MuteController] Reset');
    }
  }

  window.MuteController = new MuteController();
  window.MuteStates = States;

  console.log('[MuteController] Fixed version loaded');
})();
