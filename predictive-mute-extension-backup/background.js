/**
 * background.js
 * Service worker for the Predictive Mute extension.
 * In Manifest V3, this script runs in the background.
 * Its primary role here is to set up initial settings on installation.
 */

const DEFAULT_SETTINGS = {
    sensitivity: 0.7, // Default sensitivity for fuzzy matching
    semanticMode: true, // Enable semantic/fuzzy matching by default
};

// Fired when the extension is first installed, updated, or Chrome is updated.
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // On first install, populate storage with default settings and an empty log.
        chrome.storage.local.set({
            settings: DEFAULT_SETTINGS,
            muteLog: []
        }, () => {
            console.log('Predictive Mute V2: Default settings saved on installation.');
        });
    }
});

console.log("Predictive Mute V2: Background service worker started.");