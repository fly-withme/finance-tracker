/**
 * Contextual Suggestion Engine
 * Orchestrates all ML components to provide intelligent category suggestions
 */

import { semanticMatcher } from './semanticSimilarityMatcher.js';
import { smartPatternDetector } from './smartPatternDetector.js';
import { featureExtractor } from './enhancedFeatureExtractor.js';
import { db } from '../utils/db.js';

export class ContextualSuggestionEngine {
  constructor() {
    this.suggestionSources = {
      similarity: { weight: 0.35, source: semanticMatcher },
      patterns: { weight: 0.30, source: smartPatternDetector },
      rules: { weight: 0.25, source: this },
      user: { weight: 0.10, source: this }
    };
    
    this.confidenceThresholds = {
      HIGH: 0.85,
      MEDIUM: 0.70,
      LOW: 0.50
    };

    this.cache = new Map();
    this.userPreferences = null;
  }

  /**
   * Get smart category suggestions for a transaction
   */
  async getSuggestions(transaction, options = {}) {
    const {
      maxSuggestions = 5,
      minConfidence = 0.5,
      includeReasons = true,
      preferHighConfidence = true
    } = options;

    // Check cache first
    const cacheKey = this.getCacheKey(transaction);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached.suggestions || cached; // Support both new and old cache format
    }

    try {
      // Load user preferences if not cached
      if (!this.userPreferences) {
        this.userPreferences = await this.loadUserPreferences();
      }

      // Get historical data for context
      const historicalData = await this.getHistoricalData();

      // Collect suggestions from all sources
      const allSuggestions = await Promise.all([
        this.getSimilarityBasedSuggestions(transaction, historicalData),
        this.getPatternBasedSuggestions(transaction, historicalData),
        this.getRuleBasedSuggestions(transaction),
        this.getUserBasedSuggestions(transaction, historicalData)
      ]);

      // Merge and rank suggestions
      const mergedSuggestions = this.mergeSuggestions(allSuggestions, includeReasons);
      
      // Apply user preferences
      const personalizedSuggestions = this.applyUserPreferences(mergedSuggestions);

      // Filter and sort
      const finalSuggestions = personalizedSuggestions
        .filter(suggestion => suggestion.confidence >= minConfidence)
        .sort((a, b) => {
          if (preferHighConfidence) {
            // Prioritize high confidence suggestions
            const aLevel = this.getConfidenceLevel(a.confidence);
            const bLevel = this.getConfidenceLevel(b.confidence);
            if (aLevel !== bLevel) {
              return this.compareConfidenceLevels(bLevel, aLevel);
            }
          }
          return b.confidence - a.confidence;
        })
        .slice(0, maxSuggestions);

      // Add suggestion metadata
      const enrichedSuggestions = await this.enrichSuggestions(finalSuggestions, transaction);

      // Cache the result with metadata
      this.cache.set(cacheKey, {
        suggestions: enrichedSuggestions,
        timestamp: Date.now(),
        transaction: {
          date: transaction.date,
          recipient: transaction.recipient,
          amount: transaction.amount,
          description: transaction.description
        }
      });

      return enrichedSuggestions;

    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  /**
   * Get similarity-based suggestions
   */
  async getSimilarityBasedSuggestions(transaction, historicalData) {
    const suggestions = await semanticMatcher.suggestCategoriesBySimilarity(transaction, {
      topN: 5,
      minSimilarityForSuggestion: 0.6
    });

    return suggestions.map(suggestion => ({
      category: suggestion.category,
      confidence: suggestion.confidence * this.suggestionSources.similarity.weight,
      source: 'similarity',
      originalConfidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      evidence: {
        matchCount: suggestion.matchCount,
        avgSimilarity: suggestion.similarity,
        examples: suggestion.examples
      }
    }));
  }

  /**
   * Get pattern-based suggestions
   */
  async getPatternBasedSuggestions(transaction, historicalData) {
    const suggestions = await smartPatternDetector.getPatternBasedSuggestions(transaction, {
      topN: 5,
      minConfidence: 0.6
    });

    return suggestions.map(suggestion => ({
      category: suggestion.category,
      confidence: suggestion.confidence * this.suggestionSources.patterns.weight,
      source: 'pattern',
      patternType: suggestion.type,
      originalConfidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      evidence: suggestion.evidence
    }));
  }

  /**
   * Get rule-based suggestions
   */
  async getRuleBasedSuggestions(transaction) {
    const suggestions = [];
    const recipient = (transaction.recipient || '').toLowerCase();
    const description = (transaction.description || '').toLowerCase();
    const amount = Math.abs(transaction.amount);
    const fullText = `${recipient} ${description}`;

    // Business rules for common patterns
    const rules = [
      {
        condition: () => /rewe|edeka|aldi|lidl|kaufland|real|netto|penny|supermarkt/i.test(fullText),
        category: 'Lebensmittel',
        confidence: 0.9,
        reasoning: 'Supermarkt erkannt'
      },
      {
        condition: () => /shell|aral|esso|bp|jet|tankstelle/i.test(fullText),
        category: 'Transport',
        confidence: 0.9,
        reasoning: 'Tankstelle erkannt'
      },
      {
        condition: () => /netflix|spotify|amazon prime|disney|youtube premium/i.test(fullText),
        category: 'Unterhaltung',
        confidence: 0.95,
        reasoning: 'Streaming-Dienst erkannt'
      },
      {
        condition: () => /mcdonalds|burger king|kfc|pizza|restaurant|lieferando|deliveroo/i.test(fullText),
        category: 'Restaurant',
        confidence: 0.85,
        reasoning: 'Restaurant/Lieferdienst erkannt'
      },
      {
        condition: () => /amazon|ebay|zalando|otto|online.*shop/i.test(fullText),
        category: 'Online Shopping',
        confidence: 0.8,
        reasoning: 'Online-Shop erkannt'
      },
      {
        condition: () => /miete|nebenkosten|wohnung|immobilien/i.test(fullText) && amount > 300,
        category: 'Wohnen',
        confidence: 0.95,
        reasoning: 'Miete/Wohnkosten erkannt'
      },
      {
        condition: () => /strom|gas|wasser|internet|telefon|telekom|vodafone/i.test(fullText),
        category: 'Nebenkosten',
        confidence: 0.9,
        reasoning: 'Nebenkosten erkannt'
      },
      {
        condition: () => /versicherung|allianz|axa|ergo|huk/i.test(fullText),
        category: 'Versicherung',
        confidence: 0.9,
        reasoning: 'Versicherung erkannt'
      },
      {
        condition: () => /apotheke|arzt|krankenhaus|medizin|gesundheit/i.test(fullText),
        category: 'Gesundheit',
        confidence: 0.85,
        reasoning: 'Gesundheitsdienstleister erkannt'
      },
      {
        condition: () => /gehalt|lohn|salary/i.test(fullText) && transaction.amount > 0,
        category: 'Einkommen',
        confidence: 0.95,
        reasoning: 'Gehaltszahlung erkannt'
      },
      {
        condition: () => /öpnv|bahn|bus|hvv|bvg|mvv|ticket/i.test(fullText),
        category: 'Transport',
        confidence: 0.85,
        reasoning: 'Öffentliche Verkehrsmittel erkannt'
      },
      {
        condition: () => /drogerie|dm|rossmann|müller/i.test(fullText),
        category: 'Drogerie',
        confidence: 0.9,
        reasoning: 'Drogerie erkannt'
      }
    ];

    rules.forEach((rule, index) => {
      if (rule.condition()) {
        suggestions.push({
          category: rule.category,
          confidence: rule.confidence * this.suggestionSources.rules.weight,
          source: 'rule',
          ruleId: index,
          originalConfidence: rule.confidence,
          reasoning: rule.reasoning,
          evidence: { matchedPattern: true }
        });
      }
    });

    return suggestions;
  }

  /**
   * Get user behavior-based suggestions
   */
  async getUserBasedSuggestions(transaction, historicalData) {
    const suggestions = [];
    
    if (!this.userPreferences || historicalData.length === 0) {
      return suggestions;
    }

    // Suggest based on user's most common categories
    const topCategories = this.userPreferences.topCategories || [];
    const amount = Math.abs(transaction.amount);
    
    topCategories.forEach((categoryInfo, index) => {
      const { category, avgAmount, frequency } = categoryInfo;
      
      // Higher confidence if amount is similar to user's typical amount for this category
      let confidence = 0.3; // Base confidence
      
      if (Math.abs(avgAmount - amount) < avgAmount * 0.3) {
        confidence += 0.3; // Amount similarity boost
      }
      
      // Boost based on category frequency
      confidence += (frequency / 100) * 0.2;
      
      // Penalize lower-ranked categories
      confidence *= (1 - index * 0.1);
      
      if (confidence > 0.4) {
        suggestions.push({
          category,
          confidence: confidence * this.suggestionSources.user.weight,
          source: 'user_behavior',
          originalConfidence: confidence,
          reasoning: `Sie verwenden oft die Kategorie "${category}" (${frequency}% Ihrer Transaktionen)`,
          evidence: {
            userFrequency: frequency,
            avgAmount: avgAmount,
            categoryRank: index + 1
          }
        });
      }
    });

    return suggestions;
  }

  /**
   * Merge suggestions from different sources
   */
  mergeSuggestions(allSuggestions, includeReasons = true) {
    const categoryMap = new Map();

    // Flatten all suggestions
    allSuggestions.flat().forEach(suggestion => {
      const category = suggestion.category;
      
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category);
        
        // Combine confidences using weighted average
        const totalWeight = existing.totalWeight + suggestion.confidence;
        const combinedConfidence = (existing.confidence * existing.totalWeight + 
                                  suggestion.confidence * suggestion.confidence) / totalWeight;
        
        existing.confidence = Math.min(combinedConfidence, 0.99);
        existing.totalWeight = totalWeight;
        existing.sources.push(suggestion.source);
        
        if (includeReasons && suggestion.reasoning) {
          existing.reasons = existing.reasons || [];
          existing.reasons.push(suggestion.reasoning);
        }

        if (suggestion.evidence) {
          existing.evidence = existing.evidence || {};
          existing.evidence[suggestion.source] = suggestion.evidence;
        }
        
      } else {
        categoryMap.set(category, {
          category,
          confidence: suggestion.confidence,
          totalWeight: suggestion.confidence,
          sources: [suggestion.source],
          reasons: includeReasons && suggestion.reasoning ? [suggestion.reasoning] : [],
          evidence: suggestion.evidence ? { [suggestion.source]: suggestion.evidence } : {},
          originalSuggestions: [suggestion]
        });
      }
    });

    return Array.from(categoryMap.values());
  }

  /**
   * Apply user preferences to suggestions
   */
  applyUserPreferences(suggestions) {
    if (!this.userPreferences) return suggestions;

    return suggestions.map(suggestion => {
      let adjustedConfidence = suggestion.confidence;

      // Boost preferred categories
      if (this.userPreferences.preferredCategories?.includes(suggestion.category)) {
        adjustedConfidence *= 1.1;
      }

      // Penalize avoided categories
      if (this.userPreferences.avoidedCategories?.includes(suggestion.category)) {
        adjustedConfidence *= 0.8;
      }

      return {
        ...suggestion,
        confidence: Math.min(adjustedConfidence, 0.99)
      };
    });
  }

  /**
   * Enrich suggestions with additional metadata
   */
  async enrichSuggestions(suggestions, transaction) {
    const enrichedSuggestions = [];

    for (const suggestion of suggestions) {
      const enriched = {
        ...suggestion,
        confidenceLevel: this.getConfidenceLevel(suggestion.confidence),
        suggestedAction: this.getSuggestedAction(suggestion.confidence),
        icon: this.getCategoryIcon(suggestion.category),
        color: this.getCategoryColor(suggestion.category),
        lastUsed: await this.getLastUsedDate(suggestion.category),
        usageCount: await this.getCategoryUsageCount(suggestion.category)
      };

      // Generate combined reasoning
      if (suggestion.reasons && suggestion.reasons.length > 0) {
        enriched.combinedReasoning = this.generateCombinedReasoning(suggestion);
      }

      enrichedSuggestions.push(enriched);
    }

    return enrichedSuggestions;
  }

  /**
   * Load user preferences from database
   */
  async loadUserPreferences() {
    try {
      const preferences = await db.settings.get('userPreferences');
      
      if (!preferences) {
        // Generate preferences from historical data
        return await this.generateUserPreferences();
      }

      return preferences;
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return null;
    }
  }

  /**
   * Generate user preferences from historical data
   */
  async generateUserPreferences() {
    try {
      const transactions = await db.transactions.orderBy('date').reverse().limit(500).toArray();
      
      if (transactions.length === 0) {
        return null;
      }

      // Calculate category statistics
      const categoryStats = {};
      transactions.forEach(tx => {
        if (tx.category) {
          if (!categoryStats[tx.category]) {
            categoryStats[tx.category] = {
              count: 0,
              totalAmount: 0,
              amounts: []
            };
          }
          categoryStats[tx.category].count++;
          categoryStats[tx.category].totalAmount += Math.abs(tx.amount);
          categoryStats[tx.category].amounts.push(Math.abs(tx.amount));
        }
      });

      // Generate preferences
      const topCategories = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category,
          frequency: Math.round((stats.count / transactions.length) * 100),
          avgAmount: stats.totalAmount / stats.count,
          count: stats.count
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      const preferences = {
        topCategories,
        preferredCategories: topCategories.slice(0, 5).map(c => c.category),
        avoidedCategories: [],
        lastUpdated: new Date().toISOString()
      };

      // Save preferences
      await db.settings.put({
        key: 'userPreferences',
        ...preferences
      });

      return preferences;

    } catch (error) {
      console.error('Error generating user preferences:', error);
      return null;
    }
  }

  // Helper methods

  getConfidenceLevel(confidence) {
    if (confidence >= this.confidenceThresholds.HIGH) return 'HIGH';
    if (confidence >= this.confidenceThresholds.MEDIUM) return 'MEDIUM';
    if (confidence >= this.confidenceThresholds.LOW) return 'LOW';
    return 'VERY_LOW';
  }

  getSuggestedAction(confidence) {
    if (confidence >= 0.9) return 'auto_apply';
    if (confidence >= 0.75) return 'suggest_strongly';
    if (confidence >= 0.6) return 'suggest';
    return 'show_option';
  }

  compareConfidenceLevels(level1, level2) {
    const levels = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH'];
    return levels.indexOf(level1) - levels.indexOf(level2);
  }

  getCategoryIcon(category) {
    const iconMap = {
      'Lebensmittel': '🛒',
      'Restaurant': '🍽️',
      'Transport': '🚗',
      'Unterhaltung': '🎬',
      'Online Shopping': '🛍️',
      'Wohnen': '🏠',
      'Nebenkosten': '💡',
      'Versicherung': '🛡️',
      'Gesundheit': '⚕️',
      'Einkommen': '💰',
      'Drogerie': '🧴',
      'Bildung': '📚',
      'Sport': '⚽',
      'Reisen': '✈️'
    };
    return iconMap[category] || '📊';
  }

  getCategoryColor(category) {
    const colorMap = {
      'Lebensmittel': '#10B981',
      'Restaurant': '#F59E0B',
      'Transport': '#3B82F6',
      'Unterhaltung': '#8B5CF6',
      'Online Shopping': '#EC4899',
      'Wohnen': '#6B7280',
      'Nebenkosten': '#F97316',
      'Versicherung': '#14B8A6',
      'Gesundheit': '#EF4444',
      'Einkommen': '#22C55E',
      'Drogerie': '#A855F7',
      'Bildung': '#0EA5E9',
      'Sport': '#84CC16',
      'Reisen': '#F43F5E'
    };
    return colorMap[category] || '#6B7280';
  }

  async getLastUsedDate(category) {
    try {
      const lastTransaction = await db.transactions
        .where('category').equals(category)
        .orderBy('date')
        .reverse()
        .first();
      
      return lastTransaction?.date || null;
    } catch (error) {
      return null;
    }
  }

  async getCategoryUsageCount(category) {
    try {
      return await db.transactions.where('category').equals(category).count();
    } catch (error) {
      return 0;
    }
  }

  generateCombinedReasoning(suggestion) {
    if (!suggestion.reasons || suggestion.reasons.length === 0) {
      return 'Kategorievorschlag basierend auf verschiedenen Faktoren.';
    }

    if (suggestion.reasons.length === 1) {
      return suggestion.reasons[0];
    }

    const primaryReason = suggestion.reasons[0];
    const supportingCount = suggestion.reasons.length - 1;
    
    return `${primaryReason} (+${supportingCount} weitere ${supportingCount === 1 ? 'Indikator' : 'Indikatoren'})`;
  }

  generateCacheKey(transaction) {
    const key = `${transaction.recipient || 'unknown'}_${Math.abs(transaction.amount)}_${transaction.date}`;
    return key.substring(0, 100); // Limit key length
  }

  async getHistoricalData() {
    return await db.transactions.orderBy('date').reverse().limit(1000).toArray();
  }

  /**
   * Learn from user feedback
   */
  async learnFromFeedback(transaction, selectedCategory, rejectedSuggestions = []) {
    try {
      // Store feedback for future learning
      const feedback = {
        transaction: {
          recipient: transaction.recipient,
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date
        },
        selectedCategory,
        rejectedSuggestions,
        timestamp: new Date().toISOString()
      };

      // Save feedback to storage
      const feedbackKey = `feedback_${Date.now()}`;
      localStorage.setItem(feedbackKey, JSON.stringify(feedback));

      // Update user preferences
      await this.updateUserPreferences(selectedCategory, rejectedSuggestions);

    } catch (error) {
      console.error('Error learning from feedback:', error);
    }
  }

  async updateUserPreferences(selectedCategory, rejectedCategories) {
    if (!this.userPreferences) return;

    // Boost preference for selected category
    const preferredCategories = this.userPreferences.preferredCategories || [];
    if (!preferredCategories.includes(selectedCategory)) {
      preferredCategories.unshift(selectedCategory);
      this.userPreferences.preferredCategories = preferredCategories.slice(0, 10);
    }

    // Add rejected categories to avoided list
    const avoidedCategories = this.userPreferences.avoidedCategories || [];
    rejectedCategories.forEach(category => {
      if (!avoidedCategories.includes(category)) {
        avoidedCategories.push(category);
      }
    });
    this.userPreferences.avoidedCategories = avoidedCategories.slice(0, 20);

    // Save updated preferences
    await db.settings.put({
      key: 'userPreferences',
      ...this.userPreferences,
      lastUpdated: new Date().toISOString()
    });
  }

  /**
   * Clear cache and refresh preferences
   */
  async refresh() {
    this.cache.clear();
    this.userPreferences = null;
    await this.loadUserPreferences();
  }

  /**
   * Precompute suggestions for a transaction (for background processing)
   */
  async precomputeSuggestions(transaction) {
    try {
      // Skip if already cached
      const cacheKey = this.getCacheKey(transaction);
      if (this.cache.has(cacheKey)) {
        console.log(`🔄 Smart Suggestion bereits gecacht für: ${transaction.description?.substring(0, 30)}...`);
        return;
      }

      console.log(`🧠 Verarbeite Smart Suggestions für: ${transaction.description?.substring(0, 30)}...`);
      
      // Generate suggestions and store in cache
      const suggestions = await this.getSuggestions(transaction, {
        includeReasons: true,
        maxSuggestions: 8
      });

      console.log(`✅ ${suggestions.length} Smart Suggestions generiert für: ${transaction.description?.substring(0, 30)}...`);

      // Don't cache empty results to allow retry
      if (suggestions.length > 0) {
        // Cache the results
        this.cache.set(cacheKey, {
          suggestions,
          timestamp: Date.now(),
          transaction: {
            date: transaction.date,
            recipient: transaction.recipient,
            amount: transaction.amount,
            description: transaction.description
          }
        });
      }

    } catch (error) {
      console.warn(`Failed to precompute suggestions for "${transaction.description?.substring(0, 30)}...":`, error);
    }
  }

  /**
   * Generate cache key for transaction
   */
  getCacheKey(transaction) {
    return `${transaction.date}-${transaction.recipient}-${transaction.amount}-${transaction.description?.substring(0, 50)}`;
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      hasUserPreferences: !!this.userPreferences,
      suggestionSources: Object.keys(this.suggestionSources),
      confidenceThresholds: this.confidenceThresholds
    };
  }
}

export const contextualSuggestionEngine = new ContextualSuggestionEngine();