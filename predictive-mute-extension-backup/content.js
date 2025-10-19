/**
 * content.js
 * This is the core script that runs on Google Meet and Zoom pages.
 * It handles microphone access, speech recognition, analysis, and UI updates.
 */

(async () => {
    console.log("Predictive Mute V2: Content script loaded.");

    // --- Globals & Instances --- //
    const muteController = new MuteController();
    const semanticAnalyzer = new SemanticAnalyzer();
    let overlay = {}; // To hold overlay DOM elements
    let recognition;

    const DEFAULT_SETTINGS = {
        sensitivity: 0.7,
        semanticMode: true,
    };

    // --- Main Initialization --- //
    async function init() {
        try {
            // 1. Load settings and banned concepts
            const settings = await loadSettings();
            const concepts = await fetch(chrome.runtime.getURL('bannedConcepts.json')).then(res => res.json());
            semanticAnalyzer.loadConcepts(concepts, settings);

            // 2. Inject the UI
            injectOverlay();
            updateOverlayUI('safe', 'Initializing...');

            // 3. Set up audio and speech recognition
            await setupAudio();

            // 4. Set up a listener for mute state changes to update the UI
            muteController.onMuteStateChange = handleMuteStateChange;

            console.log("Predictive Mute V2: Initialization complete.");

        } catch (error) {
            console.error("Predictive Mute V2: Initialization failed.", error);
            if (overlay.container) {
                updateOverlayUI('risk', 'Error: Could not start.');
            }
        }
    }

    // --- Setup Functions --- //

    function loadSettings() {
        return new Promise(resolve => {
            chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, result => resolve(result.settings));
        });
    }

    async function setupAudio() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            muteController.setStream(stream);
            setupSpeechRecognition(stream);
        } catch (err) {
            console.error("Predictive Mute V2: Microphone access denied.", err);
            updateOverlayUI('risk', 'Mic access denied.');
            throw err;
        }
    }

    function setupSpeechRecognition(stream) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            updateOverlayUI('risk', 'Speech API not supported.');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            updateOverlayUI('safe', 'Listening...');
            overlay.container.classList.add('listening');
        };

        recognition.onend = () => {
            console.log("Predictive Mute V2: Speech recognition ended, restarting.");
            overlay.container.classList.remove('listening');
            // The service will stop automatically after a period of silence.
            // We restart it to keep it running.
            recognition.start();
        };

        recognition.onerror = (event) => {
            console.error("Predictive Mute V2: Speech recognition error", event.error);
            overlay.container.classList.remove('listening');
            if (event.error === 'no-speech') {
                // This is common, just ignore and let it restart.
            } else {
                updateOverlayUI('risk', `Error: ${event.error}`);
            }
        };

        recognition.onresult = handleRecognitionResult;

        recognition.start();
    }

    // --- UI Management --- //

    function injectOverlay() {
        const container = document.createElement('div');
        container.id = 'pm-overlay';
        container.innerHTML = `
            <div class="pm-header">
                <span id="pm-status-dot"></span>
                <span id="pm-status-text"></span>
            </div>
            <div class="pm-body">
                <p>Detected Phrase:</p>
                <p id="pm-detected-phrase"></p>
            </div>
        `;
        document.body.appendChild(container);

        overlay = {
            container,
            dot: document.getElementById('pm-status-dot'),
            statusText: document.getElementById('pm-status-text'),
            detectedPhrase: document.getElementById('pm-detected-phrase'),
        };

        setTimeout(() => container.classList.add('visible'), 100);
    }

    function updateOverlayUI(status, text, phrase = '&nbsp;') {
        overlay.container.className = `visible ${status}`;
        overlay.statusText.textContent = text;
        overlay.detectedPhrase.innerHTML = phrase;
    }

    // --- Core Logic --- //

    function handleRecognitionResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const transcript = finalTranscript || interimTranscript;

        // Show interim results as a "risk" state
        if (interimTranscript && !muteController.isMuted) {
            updateOverlayUI('risk', 'Analyzing...', interimTranscript);
            overlay.container.classList.add('listening');
        }

        const analysisResult = semanticAnalyzer.analyze(transcript);

        if (analysisResult) {
            const muted = muteController.mute(analysisResult.phrase);
            if (muted) {
                console.log("MUTE TRIGGERED", analysisResult);
                // The onMuteStateChange handler will update the UI
                // and schedule the unmute.
            }
        } else if (finalTranscript) {
            // If a final result comes in and it's clean, go back to safe.
            if (!muteController.isMuted) {
                updateOverlayUI('safe', 'Listening...');
            }
        }
    }

    function handleMuteStateChange({ muted, reason }) {
        if (muted) {
            recognition.stop(); // Temporarily stop recognition to prevent spam
            updateOverlayUI('muted', 'MUTED', reason);
            overlay.container.classList.remove('listening');

            // Automatically unmute and restart recognition after a delay
            setTimeout(() => {
                muteController.unmute();
            }, 2500); // 2.5-second mute duration
        } else {
            // Unmuted
            updateOverlayUI('safe', 'Listening...');
            recognition.start(); // Restart recognition
        }
    }

    // --- Start the extension --- //
    init();

})();
