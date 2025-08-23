/**
 * Semantic Similarity Matcher
 * Finds similar transactions and suggests categories based on semantic similarity
 */

import { db } from '../utils/db.js';
import { featureExtractor } from './enhancedFeatureExtractor.js';

export class SemanticSimilarityMatcher {
  constructor() {
    this.similarityCache = new Map();
    this.embeddingCache = new Map();
    this.minSimilarityThreshold = 0.6;
    this.highSimilarityThreshold = 0.8;
  }

  /**
   * Find similar historical transactions for a new transaction
   */
  async findSimilarTransactions(newTransaction, options = {}) {
    const {
      limit = 10,
      minSimilarity = this.minSimilarityThreshold,
      includeFeatures = true,
      timeWindow = null // days to look back
    } = options;

    try {
      // Get historical transactions
      let historicalTransactions = await this.getHistoricalTransactions(newTransaction, timeWindow);
      
      // Extract features for new transaction
      const newFeatures = await featureExtractor.extractFeatures(newTransaction, historicalTransactions);
      
      // Calculate similarities
      const similarities = [];
      
      for (const historical of historicalTransactions) {
        const similarity = await this.calculateTransactionSimilarity(
          newTransaction, 
          historical, 
          newFeatures,
          includeFeatures
        );
        
        if (similarity.score >= minSimilarity) {
          similarities.push({
            transaction: historical,
            similarity: similarity.score,
            reasons: similarity.reasons,
            confidence: this.calculateConfidence(similarity.score, similarity.reasons)
          });
        }
      }

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Error finding similar transactions:', error);
      return [];
    }
  }

  /**
   * Suggest categories based on similar transactions
   */
  async suggestCategoriesBySimilarity(transaction, options = {}) {
    const {
      topN = 3,
      requireHighConfidence = false,
      minSimilarityForSuggestion = this.minSimilarityThreshold
    } = options;

    const similarTransactions = await this.findSimilarTransactions(transaction, {
      limit: 20,
      minSimilarity: minSimilarityForSuggestion
    });

    if (similarTransactions.length === 0) {
      return [];
    }

    // Group by category and calculate weighted scores
    const categoryScores = {};
    
    similarTransactions.forEach(({ transaction: tx, similarity, confidence }) => {
      if (!tx.category) return;
      
      const weight = similarity * confidence;
      
      if (!categoryScores[tx.category]) {
        categoryScores[tx.category] = {
          category: tx.category,
          totalScore: 0,
          count: 0,
          examples: [],
          avgSimilarity: 0,
          confidence: 0
        };
      }
      
      categoryScores[tx.category].totalScore += weight;
      categoryScores[tx.category].count += 1;
      categoryScores[tx.category].examples.push({
        recipient: tx.recipient,
        amount: tx.amount,
        similarity: similarity
      });
    });

    // Calculate final scores and create suggestions
    const suggestions = Object.values(categoryScores)
      .map(score => ({
        category: score.category,
        confidence: this.normalizeScore(score.totalScore / Math.max(score.count, 1)),
        similarity: score.totalScore / score.count,
        matchCount: score.count,
        examples: score.examples.slice(0, 3), // Top 3 examples
        reasoning: this.generateReasoning(score, similarTransactions.length)
      }))
      .filter(suggestion => 
        !requireHighConfidence || suggestion.confidence >= this.highSimilarityThreshold
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN);

    return suggestions;
  }

  /**
   * Calculate semantic similarity between two transactions
   */
  async calculateTransactionSimilarity(transaction1, transaction2, features1 = null, includeFeatures = true) {
    const cacheKey = this.getCacheKey(transaction1, transaction2);
    
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey);
    }

    const reasons = [];
    let totalScore = 0;
    let componentCount = 0;

    // 1. Text similarity (recipient + description)
    const textSimilarity = this.calculateTextSimilarity(transaction1, transaction2);
    totalScore += textSimilarity.score * 0.4; // 40% weight
    componentCount++;
    
    if (textSimilarity.score > 0.7) {
      reasons.push(`Ähnlicher Text (${Math.round(textSimilarity.score * 100)}%)`);
    }

    // 2. Amount similarity
    const amountSimilarity = this.calculateAmountSimilarity(transaction1, transaction2);
    totalScore += amountSimilarity.score * 0.3; // 30% weight
    componentCount++;
    
    if (amountSimilarity.score > 0.8) {
      reasons.push(`Ähnlicher Betrag (${amountSimilarity.reason})`);
    }

    // 3. Temporal similarity
    const temporalSimilarity = this.calculateTemporalSimilarity(transaction1, transaction2);
    totalScore += temporalSimilarity.score * 0.15; // 15% weight
    componentCount++;
    
    if (temporalSimilarity.score > 0.8) {
      reasons.push(`Ähnliche Zeit (${temporalSimilarity.reason})`);
    }

    // 4. Feature similarity (if requested and available)
    if (includeFeatures && features1) {
      const features2 = await featureExtractor.extractFeatures(transaction2);
      const featureSimilarity = featureExtractor.calculateFeatureSimilarity(features1, features2);
      totalScore += featureSimilarity * 0.15; // 15% weight
      componentCount++;
      
      if (featureSimilarity > 0.8) {
        reasons.push(`Ähnliche Merkmale (${Math.round(featureSimilarity * 100)}%)`);
      }
    }

    const finalScore = componentCount > 0 ? totalScore / componentCount : 0;
    
    const result = {
      score: finalScore,
      reasons: reasons,
      components: {
        text: textSimilarity.score,
        amount: amountSimilarity.score,
        temporal: temporalSimilarity.score
      }
    };

    // Cache the result
    this.similarityCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Calculate text similarity using token overlap and fuzzy matching
   */
  calculateTextSimilarity(tx1, tx2) {
    const text1 = `${tx1.recipient || ''} ${tx1.description || ''}`.toLowerCase();
    const text2 = `${tx2.recipient || ''} ${tx2.description || ''}`.toLowerCase();

    if (!text1.trim() || !text2.trim()) {
      return { score: 0, reason: 'Kein Text verfügbar' };
    }

    // Token-based Jaccard similarity
    const tokens1 = featureExtractor.tokenize(text1);
    const tokens2 = featureExtractor.tokenize(text2);
    
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;

    // Substring similarity for merchants
    const recipient1 = (tx1.recipient || '').toLowerCase();
    const recipient2 = (tx2.recipient || '').toLowerCase();
    
    let substringScore = 0;
    if (recipient1 && recipient2) {
      const longer = recipient1.length > recipient2.length ? recipient1 : recipient2;
      const shorter = recipient1.length > recipient2.length ? recipient2 : recipient1;
      
      if (longer.includes(shorter) || shorter.includes(longer)) {
        substringScore = shorter.length / longer.length;
      }
    }

    // Combined score
    const finalScore = Math.max(jaccardScore, substringScore * 0.8);
    
    return {
      score: finalScore,
      reason: finalScore > 0.7 ? 'Ähnlicher Empfänger/Text' : 'Geringfügige Textähnlichkeit'
    };
  }

  /**
   * Calculate amount similarity
   */
  calculateAmountSimilarity(tx1, tx2) {
    const amount1 = Math.abs(tx1.amount);
    const amount2 = Math.abs(tx2.amount);
    
    if (amount1 === amount2) {
      return { score: 1.0, reason: 'Identischer Betrag' };
    }

    const diff = Math.abs(amount1 - amount2);
    const maxAmount = Math.max(amount1, amount2);
    
    // Perfect match for identical amounts
    if (diff === 0) {
      return { score: 1.0, reason: 'Identischer Betrag' };
    }
    
    // High similarity for small differences
    if (diff < 1) {
      return { score: 0.95, reason: 'Nahezu identischer Betrag' };
    }
    
    // Good similarity for amounts within 10% of each other
    const percentDiff = diff / maxAmount;
    if (percentDiff <= 0.1) {
      return { score: 0.9, reason: `${Math.round((1-percentDiff) * 100)}% ähnlicher Betrag` };
    }
    
    // Moderate similarity for amounts within 25%
    if (percentDiff <= 0.25) {
      return { score: 0.7, reason: 'Ähnlicher Betrag' };
    }
    
    // Low similarity based on relative difference
    const similarity = Math.max(0, 1 - (percentDiff * 2));
    
    return {
      score: similarity,
      reason: similarity > 0.5 ? 'Etwas ähnlicher Betrag' : 'Unterschiedlicher Betrag'
    };
  }

  /**
   * Calculate temporal similarity
   */
  calculateTemporalSimilarity(tx1, tx2) {
    const date1 = new Date(tx1.date);
    const date2 = new Date(tx2.date);
    
    const dayDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
    
    // Same day
    if (dayDiff < 1) {
      return { score: 1.0, reason: 'Gleicher Tag' };
    }
    
    // Same day of week
    const sameWeekday = date1.getDay() === date2.getDay();
    if (sameWeekday && dayDiff <= 7) {
      return { score: 0.9, reason: 'Gleicher Wochentag' };
    }
    
    // Same day of month (recurring payments)
    const sameDayOfMonth = date1.getDate() === date2.getDate();
    if (sameDayOfMonth) {
      return { score: 0.8, reason: 'Gleicher Monatstag' };
    }
    
    // Within a week
    if (dayDiff <= 7) {
      return { score: 0.7, reason: 'Innerhalb einer Woche' };
    }
    
    // Within a month
    if (dayDiff <= 31) {
      return { score: 0.5, reason: 'Innerhalb eines Monats' };
    }
    
    // Decay score over time
    const score = Math.max(0, 1 - (dayDiff / 365)); // Decay over a year
    
    return {
      score: score,
      reason: score > 0.3 ? 'Ähnlicher Zeitraum' : 'Unterschiedliche Zeit'
    };
  }

  /**
   * Get historical transactions for comparison
   */
  async getHistoricalTransactions(newTransaction, timeWindowDays = null) {
    let query = db.transactions.orderBy('date').reverse();
    
    if (timeWindowDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
      query = query.where('date').above(cutoffDate.toISOString().split('T')[0]);
    }
    
    const transactions = await query.limit(500).toArray(); // Limit for performance
    
    // Filter out transactions that are too different in amount (performance optimization)
    const amount = Math.abs(newTransaction.amount);
    return transactions.filter(tx => {
      const txAmount = Math.abs(tx.amount);
      return txAmount > amount * 0.1 && txAmount < amount * 10; // Within 10x range
    });
  }

  /**
   * Calculate confidence based on similarity score and reasons
   */
  calculateConfidence(similarity, reasons) {
    let confidence = similarity;
    
    // Boost confidence for multiple strong reasons
    if (reasons.length >= 2) {
      confidence = Math.min(confidence * 1.1, 0.98);
    }
    
    if (reasons.length >= 3) {
      confidence = Math.min(confidence * 1.15, 0.99);
    }
    
    return confidence;
  }

  /**
   * Normalize score to confidence range
   */
  normalizeScore(score) {
    return Math.min(Math.max(score, 0), 0.99);
  }

  /**
   * Generate human-readable reasoning
   */
  generateReasoning(categoryScore, totalSimilarCount) {
    const { category, count, examples } = categoryScore;
    const percentage = Math.round((count / totalSimilarCount) * 100);
    
    let reasoning = `${count} von ${totalSimilarCount} ähnlichen Transaktionen (${percentage}%) `;
    reasoning += `wurden als "${category}" kategorisiert. `;
    
    if (examples.length > 0) {
      const topExample = examples[0];
      reasoning += `Ähnlichste Transaktion: ${topExample.recipient} (${Math.round(topExample.similarity * 100)}% Ähnlichkeit).`;
    }
    
    return reasoning;
  }

  /**
   * Generate cache key for similarity calculations
   */
  getCacheKey(tx1, tx2) {
    const id1 = tx1.id || `${tx1.date}_${tx1.amount}_${tx1.recipient}`.substring(0, 50);
    const id2 = tx2.id || `${tx2.date}_${tx2.amount}_${tx2.recipient}`.substring(0, 50);
    return `${id1}:${id2}`;
  }

  /**
   * Clear similarity cache (call periodically to prevent memory leaks)
   */
  clearCache() {
    this.similarityCache.clear();
    this.embeddingCache.clear();
  }

  /**
   * Get similarity statistics for debugging
   */
  getStats() {
    return {
      cacheSize: this.similarityCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      thresholds: {
        min: this.minSimilarityThreshold,
        high: this.highSimilarityThreshold
      }
    };
  }
}

export const semanticMatcher = new SemanticSimilarityMatcher();