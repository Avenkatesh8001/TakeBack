// Feedback Collection System for Continuous Learning
// Collects user feedback on mute decisions and exports training data

(function() {
  'use strict';

  class FeedbackCollector {
    constructor() {
      this.dataset = { samples: [] };
      this.loadDataset();
    }

    loadDataset() {
      chrome.storage.local.get(['trainingDataset'], (data) => {
        if (data.trainingDataset) {
          this.dataset = data.trainingDataset;
          console.log(`[FeedbackCollector] Loaded ${this.dataset.samples.length} samples`);
        }
      });
    }

    saveDataset() {
      chrome.storage.local.set({ trainingDataset: this.dataset }, () => {
        console.log(`[FeedbackCollector] Saved ${this.dataset.samples.length} samples`);
      });
    }

    // Record feedback from user
    recordFeedback(transcript, detectionResult, userLabel) {
      const sample = {
        text: transcript,
        timestamp: Date.now(),
        prediction: {
          decision: detectionResult.decision || 'MUTE',
          confidence: detectionResult.confidence || 0,
          method: detectionResult.reason || 'unknown',
          breakdown: detectionResult.breakdown || {}
        },
        userLabel: userLabel, // 1 = correct (leak), 0 = false positive (safe)
        correctPrediction: userLabel === 1 // 1 means user confirmed it was correct
      };

      this.dataset.samples.push(sample);
      this.saveDataset();

      console.log('[FeedbackCollector] Recorded:', {
        text: transcript.substring(0, 40),
        userLabel,
        correctPrediction: sample.correctPrediction
      });

      // Check if we should offer export
      if (this.dataset.samples.length % 50 === 0) {
        this.notifyReadyForExport();
      }

      return sample;
    }

    // Get statistics
    getStats() {
      const total = this.dataset.samples.length;
      if (total === 0) {
        return {
          totalSamples: 0,
          correctPredictions: 0,
          falsePositives: 0,
          accuracy: 0
        };
      }

      const correct = this.dataset.samples.filter(s => s.correctPrediction).length;
      const falsePositives = this.dataset.samples.filter(
        s => !s.correctPrediction && s.prediction.decision === 'MUTE'
      ).length;

      const accuracy = (correct / total * 100).toFixed(1);

      return {
        totalSamples: total,
        correctPredictions: correct,
        falsePositives: falsePositives,
        accuracy: `${accuracy}%`,
        methodBreakdown: this.getMethodBreakdown()
      };
    }

    getMethodBreakdown() {
      const methods = {};

      for (const sample of this.dataset.samples) {
        const method = sample.prediction.method || 'unknown';
        if (!methods[method]) {
          methods[method] = { total: 0, correct: 0 };
        }
        methods[method].total++;
        if (sample.correctPrediction) {
          methods[method].correct++;
        }
      }

      return methods;
    }

    // Export dataset as CSV for retraining
    exportDataset() {
      const csvRows = ['text,label,model_confidence,method,timestamp'];

      for (const sample of this.dataset.samples) {
        const row = [
          `"${sample.text.replace(/"/g, '""')}"`, // Escape quotes
          sample.userLabel,
          sample.prediction.confidence.toFixed(3),
          sample.prediction.method,
          new Date(sample.timestamp).toISOString()
        ].join(',');

        csvRows.push(row);
      }

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);

      // Download file
      const a = document.createElement('a');
      a.href = url;
      a.download = `predictive-mute-training-data-${Date.now()}.csv`;
      a.click();

      URL.revokeObjectURL(url);

      console.log(`[FeedbackCollector] Exported ${this.dataset.samples.length} samples`);

      return csv;
    }

    // Export as JSON (for more detailed analysis)
    exportJSON() {
      const json = JSON.stringify(this.dataset, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `predictive-mute-training-data-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);

      console.log(`[FeedbackCollector] Exported JSON with ${this.dataset.samples.length} samples`);

      return json;
    }

    // Clear all data
    clearDataset() {
      this.dataset = { samples: [] };
      this.saveDataset();
      console.log('[FeedbackCollector] Dataset cleared');
    }

    // Notify user that export is recommended
    notifyReadyForExport() {
      console.log(
        `[FeedbackCollector] 🎉 ${this.dataset.samples.length} samples collected! ` +
        `Consider exporting for model retraining.`
      );

      // Send message to popup if it's open
      chrome.runtime.sendMessage({
        type: 'FEEDBACK_EXPORT_READY',
        count: this.dataset.samples.length
      }).catch(() => {
        // Popup might not be open, that's okay
      });
    }

    // Get recent samples for display
    getRecentSamples(limit = 10) {
      return this.dataset.samples
        .slice(-limit)
        .reverse()
        .map(s => ({
          text: s.text.substring(0, 60) + (s.text.length > 60 ? '...' : ''),
          timestamp: new Date(s.timestamp).toLocaleString(),
          correct: s.correctPrediction,
          method: s.prediction.method,
          confidence: (s.prediction.confidence * 100).toFixed(0) + '%'
        }));
    }

    // Import dataset from JSON
    importDataset(json) {
      try {
        const imported = JSON.parse(json);
        if (imported.samples && Array.isArray(imported.samples)) {
          // Merge with existing data
          const existingTexts = new Set(this.dataset.samples.map(s => s.text));

          let added = 0;
          for (const sample of imported.samples) {
            if (!existingTexts.has(sample.text)) {
              this.dataset.samples.push(sample);
              added++;
            }
          }

          this.saveDataset();
          console.log(`[FeedbackCollector] Imported ${added} new samples`);
          return { success: true, added };
        }
      } catch (error) {
        console.error('[FeedbackCollector] Import failed:', error);
        return { success: false, error: error.message };
      }
    }
  }

  // Export singleton instance
  window.FeedbackCollector = FeedbackCollector;
  window.feedbackCollector = new FeedbackCollector();

  console.log('[FeedbackCollector] Module loaded');

})();
