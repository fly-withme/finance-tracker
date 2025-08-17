/**
 * Enhanced Machine Learning System für automatische Transaktionskategorisierung
 * Features:
 * - Multi-Feature Learning (Betrag, Beschreibung, Empfänger, Zeit)
 * - Kontextuelle Muster-Erkennung
 * - Adaptive Confidence Scoring
 * - Negative Feedback Learning
 * - Time-based Pattern Recognition
 * - Amount-based Classification
 */

export class EnhancedTransactionClassifier {
  constructor(initialModel = {}) {
    // Core pattern storage
    this.patterns = new Map(Object.entries(initialModel.patterns || {}));
    this.recipientPatterns = new Map(Object.entries(initialModel.recipientPatterns || {}));
    this.amountRanges = new Map(Object.entries(initialModel.amountRanges || {}));
    this.timePatterns = new Map(Object.entries(initialModel.timePatterns || {}));
    this.negativePatterns = new Map(Object.entries(initialModel.negativePatterns || {}));
    
    // Learning statistics
    this.learningHistory = initialModel.learningHistory || [];
    this.userCorrections = initialModel.userCorrections || [];
    this.categoryUsageStats = new Map(Object.entries(initialModel.categoryUsageStats || {}));
    
    // Configuration
    this.stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'vom', 'zum',
      'der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'an', 'zu', 'für', 'von', 'mit', 'bei', 'am', 'im'
    ]);
    
    this.confidenceThreshold = 0.3;
    this.maxPatterns = 10000; // Prevent memory bloat
  }

  /**
   * Extrahiert Features aus einer Transaktion für ML-Analyse
   */
  extractFeatures(transaction) {
    const features = {
      description: this.extractKeywords(transaction.description || ''),
      recipient: this.normalizeRecipient(transaction.recipient || ''),
      amount: Math.abs(transaction.amount || 0),
      isIncome: (transaction.amount || 0) > 0,
      dayOfWeek: new Date(transaction.date).getDay(),
      hourOfDay: new Date(transaction.date).getHours(),
      amountCategory: this.categorizeAmount(Math.abs(transaction.amount || 0))
    };
    
    return features;
  }

  /**
   * Normalisiert Empfänger-Namen für bessere Muster-Erkennung
   */
  normalizeRecipient(recipient) {
    if (!recipient) return '';
    
    return recipient.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
      .split(' ')
      .filter(word => word.length > 2)
      .join(' ');
  }

  /**
   * Kategorisiert Beträge in Bereiche für Muster-Erkennung
   */
  categorizeAmount(amount) {
    if (amount <= 5) return 'micro';
    if (amount <= 25) return 'small';
    if (amount <= 100) return 'medium';
    if (amount <= 500) return 'large';
    if (amount <= 2000) return 'xlarge';
    return 'huge';
  }

  /**
   * Erweiterte Keyword-Extraktion mit besserer Normalisierung
   */
  extractKeywords(description) {
    if (!description) return [];
    
    // Normalisierung
    let normalized = description.toLowerCase()
      .replace(/[^\w\säöüß]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Spezielle Behandlung für deutsche Umlaute und ß
    normalized = normalized.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    
    const words = normalized.split(' ')
      .filter(word => word.length > 2)
      .filter(word => !this.stopWords.has(word))
      .filter(word => !/^\d+$/.test(word));
    
    const keywords = new Set();
    
    // Single words
    words.forEach(word => keywords.add(word));
    
    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      keywords.add(`${words[i]} ${words[i + 1]}`);
    }
    
    // Trigrams für wichtige Kombinationen
    if (words.length >= 3) {
      for (let i = 0; i < words.length - 2; i++) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (trigram.length <= 30) { // Verhindere zu lange Trigrams
          keywords.add(trigram);
        }
      }
    }
    
    return Array.from(keywords);
  }

  /**
   * Intelligente Kategorieprognose mit Multi-Feature-Analyse
   */
  predictCategory(transaction, availableCategories = []) {
    const features = this.extractFeatures(transaction);
    const scores = new Map();
    
    // 1. Beschreibungs-basierte Scores
    this.calculateDescriptionScores(features.description, scores);
    
    // 2. Empfänger-basierte Scores
    this.calculateRecipientScores(features.recipient, scores);
    
    // 3. Betrags-basierte Scores
    this.calculateAmountScores(features.amount, features.amountCategory, features.isIncome, scores);
    
    // 4. Zeit-basierte Scores
    this.calculateTimeScores(features.dayOfWeek, features.hourOfDay, scores);
    
    // 5. Negative Pattern Check
    this.applyNegativePatterns(features, scores);
    
    // 6. User Preference Weighting
    this.applyUserPreferences(scores);
    
    // Finde beste Kategorie
    let bestCategory = null;
    let bestScore = 0;
    let bestConfidence = 0;
    
    for (const [category, score] of scores.entries()) {
      if (score > bestScore && score >= this.confidenceThreshold) {
        bestCategory = category;
        bestScore = score;
        bestConfidence = Math.min(1.0, score);
      }
    }
    
    // Prüfe ob Kategorie verfügbar ist
    if (bestCategory && availableCategories.length > 0) {
      const categoryExists = availableCategories.some(cat => cat.name === bestCategory);
      if (!categoryExists) {
        bestCategory = null;
        bestConfidence = 0;
      }
    }
    
    return {
      category: bestCategory,
      confidence: bestConfidence,
      alternativeScores: Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, score]) => ({ category: cat, confidence: Math.min(1.0, score) }))
    };
  }

  /**
   * Berechnet Scores basierend auf Beschreibungs-Patterns
   */
  calculateDescriptionScores(keywords, scores) {
    for (const keyword of keywords) {
      // Exakte Übereinstimmungen
      const exactMatch = this.patterns.get(keyword);
      if (exactMatch) {
        const currentScore = scores.get(exactMatch.category) || 0;
        scores.set(exactMatch.category, currentScore + exactMatch.confidence);
      }
      
      // Partielle Übereinstimmungen mit reduziertem Gewicht
      for (const [pattern, data] of this.patterns.entries()) {
        if (pattern !== keyword && (pattern.includes(keyword) || keyword.includes(pattern))) {
          const currentScore = scores.get(data.category) || 0;
          const weight = Math.min(keyword.length, pattern.length) / Math.max(keyword.length, pattern.length);
          scores.set(data.category, currentScore + (data.confidence * weight * 0.5));
        }
      }
    }
  }

  /**
   * Berechnet Scores basierend auf Empfänger-Patterns
   */
  calculateRecipientScores(recipient, scores) {
    if (!recipient) return;
    
    const recipientData = this.recipientPatterns.get(recipient);
    if (recipientData) {
      const currentScore = scores.get(recipientData.category) || 0;
      scores.set(recipientData.category, currentScore + recipientData.confidence * 1.2); // Höheres Gewicht für Empfänger
    }
  }

  /**
   * Berechnet Scores basierend auf Betrags-Patterns
   */
  calculateAmountScores(amount, amountCategory, isIncome, scores) {
    // Income/Expense Unterscheidung
    if (isIncome) {
      const currentScore = scores.get('Income') || 0;
      scores.set('Income', currentScore + 0.8);
    }
    
    // Betrags-Kategorie Patterns
    const amountData = this.amountRanges.get(amountCategory);
    if (amountData) {
      for (const [category, confidence] of Object.entries(amountData)) {
        const currentScore = scores.get(category) || 0;
        scores.set(category, currentScore + confidence * 0.3);
      }
    }
  }

  /**
   * Berechnet Scores basierend auf Zeit-Patterns
   */
  calculateTimeScores(dayOfWeek, hourOfDay, scores) {
    const timeKey = `${dayOfWeek}-${Math.floor(hourOfDay / 6)}`; // 4 Tagesabschnitte
    const timeData = this.timePatterns.get(timeKey);
    
    if (timeData) {
      for (const [category, confidence] of Object.entries(timeData)) {
        const currentScore = scores.get(category) || 0;
        scores.set(category, currentScore + confidence * 0.2);
      }
    }
  }

  /**
   * Wendet negative Patterns an (was NICHT zu einer Kategorie gehört)
   */
  applyNegativePatterns(features, scores) {
    for (const keyword of features.description) {
      const negativeData = this.negativePatterns.get(keyword);
      if (negativeData) {
        for (const [category, penalty] of Object.entries(negativeData)) {
          const currentScore = scores.get(category) || 0;
          scores.set(category, Math.max(0, currentScore - penalty));
        }
      }
    }
  }

  /**
   * Wendet Benutzervorlieben an
   */
  applyUserPreferences(scores) {
    for (const [category, score] of scores.entries()) {
      const usageStats = this.categoryUsageStats.get(category);
      if (usageStats) {
        const boost = Math.min(0.2, usageStats.frequency * 0.1);
        scores.set(category, score + boost);
      }
    }
  }

  /**
   * Erweiterte Lernfunktion mit Multi-Feature Learning
   */
  learn(transaction, correctCategory) {
    if (!transaction || !correctCategory) return;
    
    const features = this.extractFeatures(transaction);
    const currentTime = Date.now();
    
    // 1. Beschreibungs-Patterns lernen
    this.learnDescriptionPatterns(features.description, correctCategory);
    
    // 2. Empfänger-Patterns lernen
    this.learnRecipientPatterns(features.recipient, correctCategory);
    
    // 3. Betrags-Patterns lernen
    this.learnAmountPatterns(features.amountCategory, correctCategory);
    
    // 4. Zeit-Patterns lernen
    this.learnTimePatterns(features.dayOfWeek, features.hourOfDay, correctCategory);
    
    // 5. Aktualisiere Nutzungsstatistiken
    this.updateCategoryUsageStats(correctCategory);
    
    // 6. Speichere Lern-Ereignis
    this.learningHistory.push({
      timestamp: currentTime,
      transaction: transaction,
      category: correctCategory,
      features: features
    });
    
    // 7. Prüfe auf falsche Vorhersagen und lerne negative Patterns
    const prediction = this.predictCategory(transaction);
    if (prediction.category && prediction.category !== correctCategory) {
      this.learnNegativePatterns(features, prediction.category);
      this.userCorrections.push({
        timestamp: currentTime,
        predicted: prediction.category,
        actual: correctCategory,
        confidence: prediction.confidence
      });
    }
    
    // Cleanup alte Patterns
    this.cleanupPatterns();
  }

  /**
   * Lernt Beschreibungs-Patterns
   */
  learnDescriptionPatterns(keywords, category) {
    for (const keyword of keywords) {
      const existing = this.patterns.get(keyword);
      
      if (existing) {
        if (existing.category === category) {
          existing.confidence = Math.min(1.0, existing.confidence + 0.1);
          existing.reinforcements = (existing.reinforcements || 0) + 1;
        } else {
          existing.confidence = Math.max(0.1, existing.confidence - 0.15);
          if (existing.confidence < 0.3) {
            this.patterns.set(keyword, {
              category: category,
              confidence: 0.6,
              reinforcements: 1,
              timestamp: Date.now()
            });
          }
        }
      } else {
        this.patterns.set(keyword, {
          category: category,
          confidence: 0.6,
          reinforcements: 1,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Lernt Empfänger-Patterns
   */
  learnRecipientPatterns(recipient, category) {
    if (!recipient) return;
    
    const existing = this.recipientPatterns.get(recipient);
    if (existing) {
      if (existing.category === category) {
        existing.confidence = Math.min(1.0, existing.confidence + 0.15);
        existing.count = (existing.count || 0) + 1;
      } else {
        existing.confidence = Math.max(0.2, existing.confidence - 0.2);
        if (existing.confidence < 0.4) {
          this.recipientPatterns.set(recipient, {
            category: category,
            confidence: 0.7,
            count: 1,
            timestamp: Date.now()
          });
        }
      }
    } else {
      this.recipientPatterns.set(recipient, {
        category: category,
        confidence: 0.7,
        count: 1,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Lernt Betrags-Patterns
   */
  learnAmountPatterns(amountCategory, category) {
    const existing = this.amountRanges.get(amountCategory) || {};
    const currentConfidence = existing[category] || 0;
    existing[category] = Math.min(1.0, currentConfidence + 0.05);
    this.amountRanges.set(amountCategory, existing);
  }

  /**
   * Lernt Zeit-Patterns
   */
  learnTimePatterns(dayOfWeek, hourOfDay, category) {
    const timeKey = `${dayOfWeek}-${Math.floor(hourOfDay / 6)}`;
    const existing = this.timePatterns.get(timeKey) || {};
    const currentConfidence = existing[category] || 0;
    existing[category] = Math.min(0.5, currentConfidence + 0.02); // Niedrigeres Gewicht für Zeit
    this.timePatterns.set(timeKey, existing);
  }

  /**
   * Lernt negative Patterns (was NICHT zu einer Kategorie gehört)
   */
  learnNegativePatterns(features, wrongCategory) {
    for (const keyword of features.description.slice(0, 3)) { // Nur top Keywords
      const existing = this.negativePatterns.get(keyword) || {};
      const currentPenalty = existing[wrongCategory] || 0;
      existing[wrongCategory] = Math.min(0.8, currentPenalty + 0.1);
      this.negativePatterns.set(keyword, existing);
    }
  }

  /**
   * Aktualisiert Kategorie-Nutzungsstatistiken
   */
  updateCategoryUsageStats(category) {
    const existing = this.categoryUsageStats.get(category) || { count: 0, frequency: 0 };
    existing.count += 1;
    existing.frequency = Math.min(1.0, existing.count / 100); // Normalisiert auf 0-1
    existing.lastUsed = Date.now();
    this.categoryUsageStats.set(category, existing);
  }

  /**
   * Bereinigt alte und wenig verwendete Patterns
   */
  cleanupPatterns() {
    const now = Date.now();
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 Tage
    
    // Lösche alte, schwache Patterns
    for (const [pattern, data] of this.patterns.entries()) {
      if (data.confidence < 0.1 || 
          (data.timestamp && now - data.timestamp > maxAge && data.confidence < 0.3)) {
        this.patterns.delete(pattern);
      }
    }
    
    // Begrenze Anzahl der Patterns
    if (this.patterns.size > this.maxPatterns) {
      const sortedPatterns = Array.from(this.patterns.entries())
        .sort((a, b) => (b[1].confidence * (b[1].reinforcements || 1)) - (a[1].confidence * (a[1].reinforcements || 1)))
        .slice(0, this.maxPatterns);
      
      this.patterns.clear();
      for (const [pattern, data] of sortedPatterns) {
        this.patterns.set(pattern, data);
      }
    }
    
    // Begrenze Lern-Historie
    if (this.learningHistory.length > 1000) {
      this.learningHistory = this.learningHistory.slice(-1000);
    }
    
    if (this.userCorrections.length > 500) {
      this.userCorrections = this.userCorrections.slice(-500);
    }
  }

  /**
   * Gibt erweiterte Kategorie-Vorschläge zurück
   */
  getCategorySuggestions(transaction, availableCategories, limit = 5) {
    const prediction = this.predictCategory(transaction, availableCategories);
    
    if (!prediction.alternativeScores || prediction.alternativeScores.length === 0) {
      return [];
    }
    
    return prediction.alternativeScores
      .filter(suggestion => suggestion.confidence > 0.2)
      .filter(suggestion => 
        availableCategories.length === 0 || 
        availableCategories.some(cat => cat.name === suggestion.category)
      )
      .slice(0, limit)
      .map(suggestion => ({
        category: availableCategories.find(cat => cat.name === suggestion.category) || { name: suggestion.category },
        confidence: suggestion.confidence
      }));
  }

  /**
   * Gibt detaillierte Lern-Statistiken zurück
   */
  getDetailedStats() {
    const totalPatterns = this.patterns.size;
    const totalRecipients = this.recipientPatterns.size;
    const totalLearningEvents = this.learningHistory.length;
    const totalCorrections = this.userCorrections.length;
    
    // Berechne Genauigkeit der letzten Vorhersagen
    const recentCorrections = this.userCorrections.slice(-100);
    const accuracy = recentCorrections.length > 0 
      ? 1 - (recentCorrections.length / 100)
      : 0;
    
    // Top Kategorien nach Nutzung
    const categoryStats = Array.from(this.categoryUsageStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([category, stats]) => ({ category, ...stats }));
    
    return {
      totalPatterns,
      totalRecipients,
      totalLearningEvents,
      totalCorrections,
      accuracy: Math.round(accuracy * 100),
      categoryStats,
      memoryUsage: {
        patterns: this.patterns.size,
        recipients: this.recipientPatterns.size,
        amounts: this.amountRanges.size,
        time: this.timePatterns.size,
        negative: this.negativePatterns.size
      }
    };
  }

  /**
   * Exportiert das gesamte Modell für Persistierung
   */
  getEnhancedModel() {
    return {
      patterns: Object.fromEntries(this.patterns.entries()),
      recipientPatterns: Object.fromEntries(this.recipientPatterns.entries()),
      amountRanges: Object.fromEntries(this.amountRanges.entries()),
      timePatterns: Object.fromEntries(this.timePatterns.entries()),
      negativePatterns: Object.fromEntries(this.negativePatterns.entries()),
      learningHistory: this.learningHistory.slice(-100), // Nur letzte 100 Events speichern
      userCorrections: this.userCorrections.slice(-100),
      categoryUsageStats: Object.fromEntries(this.categoryUsageStats.entries())
    };
  }

  /**
   * Lädt ein gespeichertes Modell
   */
  loadEnhancedModel(modelData) {
    if (modelData.patterns) {
      this.patterns = new Map(Object.entries(modelData.patterns));
    }
    if (modelData.recipientPatterns) {
      this.recipientPatterns = new Map(Object.entries(modelData.recipientPatterns));
    }
    if (modelData.amountRanges) {
      this.amountRanges = new Map(Object.entries(modelData.amountRanges));
    }
    if (modelData.timePatterns) {
      this.timePatterns = new Map(Object.entries(modelData.timePatterns));
    }
    if (modelData.negativePatterns) {
      this.negativePatterns = new Map(Object.entries(modelData.negativePatterns));
    }
    if (modelData.learningHistory) {
      this.learningHistory = modelData.learningHistory;
    }
    if (modelData.userCorrections) {
      this.userCorrections = modelData.userCorrections;
    }
    if (modelData.categoryUsageStats) {
      this.categoryUsageStats = new Map(Object.entries(modelData.categoryUsageStats));
    }
  }
}

// Erweiterte Grund-Patterns mit deutschsprachigem Fokus
export const getEnhancedInitialModel = () => ({
  patterns: {
    // Deutsche Supermärkte und Einzelhandel
    'rewe': { category: 'Groceries', confidence: 0.95, reinforcements: 10 },
    'edeka': { category: 'Groceries', confidence: 0.95, reinforcements: 10 },
    'aldi': { category: 'Groceries', confidence: 0.95, reinforcements: 10 },
    'lidl': { category: 'Groceries', confidence: 0.95, reinforcements: 10 },
    'penny': { category: 'Groceries', confidence: 0.95, reinforcements: 8 },
    'netto': { category: 'Groceries', confidence: 0.95, reinforcements: 8 },
    'kaufland': { category: 'Groceries', confidence: 0.95, reinforcements: 8 },
    
    // Restaurants und Fast Food
    'mcdonalds': { category: 'Food & Drink', confidence: 0.9, reinforcements: 15 },
    'burger king': { category: 'Food & Drink', confidence: 0.9, reinforcements: 12 },
    'subway': { category: 'Food & Drink', confidence: 0.9, reinforcements: 10 },
    'pizza': { category: 'Food & Drink', confidence: 0.85, reinforcements: 8 },
    'restaurant': { category: 'Food & Drink', confidence: 0.8, reinforcements: 12 },
    'cafe': { category: 'Food & Drink', confidence: 0.8, reinforcements: 10 },
    'starbucks': { category: 'Food & Drink', confidence: 0.9, reinforcements: 8 },
    
    // Transport
    'deutsche bahn': { category: 'Transportation', confidence: 0.95, reinforcements: 15 },
    'db bahn': { category: 'Transportation', confidence: 0.95, reinforcements: 12 },
    'bvg': { category: 'Transportation', confidence: 0.9, reinforcements: 10 },
    'uber': { category: 'Transportation', confidence: 0.95, reinforcements: 8 },
    'taxi': { category: 'Transportation', confidence: 0.9, reinforcements: 10 },
    'tankstelle': { category: 'Transportation', confidence: 0.85, reinforcements: 12 },
    'shell': { category: 'Transportation', confidence: 0.85, reinforcements: 8 },
    'aral': { category: 'Transportation', confidence: 0.85, reinforcements: 8 },
    
    // Entertainment & Streaming
    'netflix': { category: 'Entertainment', confidence: 0.95, reinforcements: 20 },
    'spotify': { category: 'Entertainment', confidence: 0.95, reinforcements: 18 },
    'amazon prime': { category: 'Entertainment', confidence: 0.9, reinforcements: 12 },
    'disney': { category: 'Entertainment', confidence: 0.9, reinforcements: 10 },
    'youtube': { category: 'Entertainment', confidence: 0.85, reinforcements: 8 },
    'kino': { category: 'Entertainment', confidence: 0.85, reinforcements: 8 },
    'cinema': { category: 'Entertainment', confidence: 0.85, reinforcements: 8 },
    
    // Deutsche Banken und Finanzdienstleister
    'sparkasse': { category: 'Bank Fees', confidence: 0.9, reinforcements: 10 },
    'deutsche bank': { category: 'Bank Fees', confidence: 0.9, reinforcements: 8 },
    'commerzbank': { category: 'Bank Fees', confidence: 0.9, reinforcements: 8 },
    'dkb': { category: 'Bank Fees', confidence: 0.9, reinforcements: 6 },
    'ing': { category: 'Bank Fees', confidence: 0.9, reinforcements: 6 },
    'n26': { category: 'Bank Fees', confidence: 0.9, reinforcements: 6 },
    
    // Wohnen und Nebenkosten
    'miete': { category: 'Housing', confidence: 0.95, reinforcements: 20 },
    'nebenkosten': { category: 'Housing', confidence: 0.9, reinforcements: 15 },
    'versicherung': { category: 'Insurance', confidence: 0.9, reinforcements: 12 },
    'strom': { category: 'Utilities', confidence: 0.9, reinforcements: 12 },
    'gas': { category: 'Utilities', confidence: 0.9, reinforcements: 10 },
    'wasser': { category: 'Utilities', confidence: 0.9, reinforcements: 10 },
    'internet': { category: 'Utilities', confidence: 0.85, reinforcements: 8 },
    'telekom': { category: 'Utilities', confidence: 0.85, reinforcements: 8 },
    'vodafone': { category: 'Utilities', confidence: 0.85, reinforcements: 8 },
    
    // Online Shopping
    'amazon': { category: 'Shopping', confidence: 0.9, reinforcements: 25 },
    'zalando': { category: 'Shopping', confidence: 0.9, reinforcements: 15 },
    'otto': { category: 'Shopping', confidence: 0.85, reinforcements: 10 },
    'ebay': { category: 'Shopping', confidence: 0.85, reinforcements: 12 },
    'paypal': { category: 'Shopping', confidence: 0.8, reinforcements: 15 },
    
    // Einkommen
    'gehalt': { category: 'Income', confidence: 0.95, reinforcements: 20 },
    'lohn': { category: 'Income', confidence: 0.95, reinforcements: 18 },
    'sold': { category: 'Income', confidence: 0.85, reinforcements: 8 },
    'bonus': { category: 'Income', confidence: 0.9, reinforcements: 5 }
  },
  
  recipientPatterns: {},
  amountRanges: {
    'micro': { 'Food & Drink': 0.3, 'Transportation': 0.2 },
    'small': { 'Food & Drink': 0.4, 'Groceries': 0.3, 'Transportation': 0.3 },
    'medium': { 'Groceries': 0.4, 'Shopping': 0.3, 'Entertainment': 0.2 },
    'large': { 'Shopping': 0.4, 'Housing': 0.2, 'Transportation': 0.3 },
    'xlarge': { 'Housing': 0.6, 'Insurance': 0.3, 'Income': 0.4 },
    'huge': { 'Housing': 0.8, 'Income': 0.9 }
  },
  
  timePatterns: {},
  negativePatterns: {},
  learningHistory: [],
  userCorrections: [],
  categoryUsageStats: {}
});