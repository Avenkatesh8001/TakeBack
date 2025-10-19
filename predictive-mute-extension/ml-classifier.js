// ML-based text classification using Transformers.js
// Classifies text into: SAFE, CONFIDENTIAL_DISCLOSURE, OFFENSIVE_LANGUAGE, UNPROFESSIONAL_TONE

(function() {
  'use strict';

  // Classification labels
  const LABELS = {
    SAFE: 'SAFE',
    CONFIDENTIAL: 'CONFIDENTIAL_DISCLOSURE',
    OFFENSIVE: 'OFFENSIVE_LANGUAGE',
    UNPROFESSIONAL: 'UNPROFESSIONAL_TONE'
  };

  // Confidence thresholds
  const THRESHOLDS = {
    CONFIDENTIAL: 0.6,
    OFFENSIVE: 0.7,
    UNPROFESSIONAL: 0.5
  };

  // Keyword-based classification (fast fallback when model not loaded)
  const KEYWORD_PATTERNS = {
    CONFIDENTIAL: [
      // Credentials & Auth
      /\b(password|passwd|pwd|credentials?|username|login)\b/i,
      /\b(api[_\s]?key|access[_\s]?token|secret[_\s]?key|private[_\s]?key)\b/i,

      // Financial
      /\b(credit[_\s]?card|debit[_\s]?card|cvv|card[_\s]?number)\b/i,
      /\b(bank[_\s]?account|routing[_\s]?number|account[_\s]?number)\b/i,
      /\b(ssn|social[_\s]?security|tax[_\s]?id)\b/i,
      /\b(salary|compensation|bonus|stock[_\s]?options?)\b/i,

      // Business Sensitive
      /\b(confidential|proprietary|classified|internal[_\s]?only)\b/i,
      /\b(trade[_\s]?secret|nda|non[_\s]?disclosure)\b/i,
      /\b(merger|acquisition|layoff|restructur)/i,
      /\b(revenue|profit|loss|financial[_\s]?results?)\b/i,

      // Personal Data
      /\b(address|phone[_\s]?number|email[_\s]?address)\b/i,
      /\b(dob|date[_\s]?of[_\s]?birth|birth[_\s]?date)\b/i,
      /\b(medical[_\s]?record|health[_\s]?information)\b/i
    ],

    OFFENSIVE: [
      /\b(fuck|fucking|fucked|fucker|motherfuck)/i,
      /\b(shit|shitting|bullshit|horseshit)/i,
      /\b(bitch|bitches|son[_\s]?of[_\s]?a[_\s]?bitch)/i,
      /\b(ass|asshole|dumbass|badass)/i,
      /\b(damn|goddamn|dammit)/i,
      /\b(hell|what[_\s]?the[_\s]?hell)/i,
      /\b(cock|dick|pussy|cunt)/i,
      /\b(bastard|prick|douche)/i,
      /\b(retard|idiot|moron|stupid[_\s]?ass)/i,
      /\b(slut|whore|fag|faggot)/i
    ],

    UNPROFESSIONAL: [
      /\b(hate|hating|hated|i[_\s]?hate)\b/i,
      /\b(suck|sucks|sucked|this[_\s]?sucks)\b/i,
      /\b(stupid|dumb|idiotic|moronic)\b/i,
      /\b(lazy|useless|incompetent|clueless)\b/i,
      /\b(whatever|who[_\s]?cares|don'?t[_\s]?care)\b/i,
      /\b(drunk|hungover|wasted)\b/i,
      /\b(gossip|rumor|behind[_\s]?their[_\s]?back)\b/i
    ]
  };

  // Transformers.js model state
  let modelLoaded = false;
  let pipeline = null;
  let isLoading = false;

  // Load Transformers.js pipeline
  async function loadModel() {
    if (modelLoaded || isLoading) return;

    isLoading = true;
    console.log('[ML-Classifier] Loading Transformers.js model...');

    try {
      // Import Transformers.js from CDN
      const { pipeline: createPipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');

      // Use text-classification with a small, fast model
      // DistilBERT is lightweight and fast for in-browser use
      pipeline = await createPipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { quantized: true } // Use quantized version for speed
      );

      modelLoaded = true;
      isLoading = false;
      console.log('[ML-Classifier] Model loaded successfully');
    } catch (error) {
      console.error('[ML-Classifier] Failed to load model:', error);
      isLoading = false;
      // Fall back to keyword-based classification
    }
  }

  // Keyword-based classification (fast, always available)
  function classifyByKeywords(text) {
    const lowerText = text.toLowerCase();

    // Check confidential patterns
    for (const pattern of KEYWORD_PATTERNS.CONFIDENTIAL) {
      if (pattern.test(text)) {
        return {
          label: LABELS.CONFIDENTIAL,
          score: 0.9,
          method: 'keyword',
          matchedPattern: pattern.source
        };
      }
    }

    // Check offensive patterns
    for (const pattern of KEYWORD_PATTERNS.OFFENSIVE) {
      if (pattern.test(text)) {
        return {
          label: LABELS.OFFENSIVE,
          score: 0.95,
          method: 'keyword',
          matchedPattern: pattern.source
        };
      }
    }

    // Check unprofessional patterns
    for (const pattern of KEYWORD_PATTERNS.UNPROFESSIONAL) {
      if (pattern.test(text)) {
        return {
          label: LABELS.UNPROFESSIONAL,
          score: 0.7,
          method: 'keyword',
          matchedPattern: pattern.source
        };
      }
    }

    return {
      label: LABELS.SAFE,
      score: 0.95,
      method: 'keyword'
    };
  }

  // ML-based classification using sentiment + custom logic
  async function classifyByML(text) {
    if (!modelLoaded) {
      throw new Error('Model not loaded');
    }

    try {
      // Get sentiment from DistilBERT
      const sentiment = await pipeline(text, { topk: 2 });

      // Combine ML sentiment with keyword boosting
      const keywordResult = classifyByKeywords(text);

      // If keywords detected a specific category, boost that
      if (keywordResult.label !== LABELS.SAFE) {
        return {
          label: keywordResult.label,
          score: Math.min(keywordResult.score + 0.1, 1.0), // Boost confidence
          method: 'ml+keyword',
          sentimentScores: sentiment
        };
      }

      // Use ML sentiment to classify
      const negativeSentiment = sentiment.find(s => s.label === 'NEGATIVE');
      const negativeScore = negativeSentiment ? negativeSentiment.score : 0;

      if (negativeScore > 0.8) {
        return {
          label: LABELS.UNPROFESSIONAL,
          score: negativeScore,
          method: 'ml',
          sentimentScores: sentiment
        };
      }

      return {
        label: LABELS.SAFE,
        score: 1 - negativeScore,
        method: 'ml',
        sentimentScores: sentiment
      };
    } catch (error) {
      console.error('[ML-Classifier] ML inference error:', error);
      // Fall back to keywords
      return classifyByKeywords(text);
    }
  }

  // Main classification function
  async function classify(text, bannedTopics = []) {
    if (!text || text.trim().length === 0) {
      return { label: LABELS.SAFE, score: 1.0, method: 'empty' };
    }

    // CHECK BANNED TOPICS FIRST (semantic matching)
    if (bannedTopics && bannedTopics.length > 0) {
      const topicMatch = checkBannedTopics(text, bannedTopics);
      if (topicMatch) {
        return topicMatch;
      }
    }

    // Try ML first if model is loaded
    if (modelLoaded) {
      try {
        return await classifyByML(text);
      } catch (error) {
        console.warn('[ML-Classifier] ML classification failed, using keywords');
      }
    }

    // Fall back to keywords
    return classifyByKeywords(text);
  }

  // Check for banned topics with semantic similarity
  function checkBannedTopics(text, bannedTopics) {
    const lowerText = text.toLowerCase();

    for (const topic of bannedTopics) {
      const topicLower = topic.toLowerCase();
      const topicWords = topicLower.split(/\s+/);

      // Exact phrase match
      if (lowerText.includes(topicLower)) {
        return {
          label: 'BANNED_TOPIC',
          score: 0.95,
          method: 'exact-topic-match',
          matchedTopic: topic
        };
      }

      // Fuzzy match - check if most topic words appear in text
      const matchedWords = topicWords.filter(word => lowerText.includes(word));
      const matchRatio = matchedWords.length / topicWords.length;

      if (matchRatio >= 0.7) { // 70% of topic words present
        return {
          label: 'BANNED_TOPIC',
          score: 0.7 + (matchRatio * 0.2), // 70-90% confidence
          method: 'fuzzy-topic-match',
          matchedTopic: topic,
          matchRatio: Math.round(matchRatio * 100) + '%'
        };
      }

      // Semantic similarity for single-word topics
      if (topicWords.length === 1) {
        const topicWord = topicWords[0];
        const words = lowerText.split(/\s+/);

        for (const word of words) {
          // Check for word variations (stem matching)
          if (word.includes(topicWord) || topicWord.includes(word)) {
            if (Math.abs(word.length - topicWord.length) <= 3) {
              return {
                label: 'BANNED_TOPIC',
                score: 0.75,
                method: 'semantic-topic-match',
                matchedTopic: topic,
                matchedWord: word
              };
            }
          }
        }
      }
    }

    return null;
  }

  // Check if classification result should trigger mute
  function shouldMute(classification) {
    const { label, score } = classification;

    switch (label) {
      case LABELS.CONFIDENTIAL:
        return score >= THRESHOLDS.CONFIDENTIAL;
      case LABELS.OFFENSIVE:
        return score >= THRESHOLDS.OFFENSIVE;
      case LABELS.UNPROFESSIONAL:
        return score >= THRESHOLDS.UNPROFESSIONAL;
      case 'BANNED_TOPIC':
        return score >= 0.7; // 70% threshold for banned topics
      case LABELS.SAFE:
      default:
        return false;
    }
  }

  // Get risk level for UI display
  function getRiskLevel(classification) {
    const { label, score } = classification;

    if (label === LABELS.SAFE) return { level: 'safe', color: 'green' };

    if (score >= 0.8) return { level: 'high', color: 'red' };
    if (score >= 0.6) return { level: 'medium', color: 'orange' };
    return { level: 'low', color: 'yellow' };
  }

  // Export API
  window.MLClassifier = {
    loadModel,
    classify,
    classifyByKeywords,
    shouldMute,
    getRiskLevel,
    isModelLoaded: () => modelLoaded,
    LABELS
  };

  // Auto-load model on script load (async, non-blocking)
  loadModel().catch(err => {
    console.warn('[ML-Classifier] Model auto-load failed:', err);
  });

  console.log('[ML-Classifier] Module loaded. Using keyword-based classification until ML model loads.');
})();
