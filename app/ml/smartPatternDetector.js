/**
 * Smart Pattern Detector
 * Detects recurring payments, seasonal patterns, and user behavior patterns
 */

import { db } from '../utils/db.js';

export class SmartPatternDetector {
  constructor() {
    this.patterns = {
      recurring: new RecurringPaymentDetector(),
      seasonal: new SeasonalPatternDetector(),
      behavioral: new BehavioralPatternDetector(),
      temporal: new TemporalPatternDetector()
    };
  }

  /**
   * Detect all patterns for a transaction
   */
  async detectPatterns(transaction, historicalData = null) {
    if (!historicalData) {
      historicalData = await this.getHistoricalData();
    }

    const patterns = await Promise.all([
      this.patterns.recurring.detect(transaction, historicalData),
      this.patterns.seasonal.detect(transaction, historicalData),
      this.patterns.behavioral.detect(transaction, historicalData),
      this.patterns.temporal.detect(transaction, historicalData)
    ]);

    return {
      recurring: patterns[0],
      seasonal: patterns[1],
      behavioral: patterns[2],
      temporal: patterns[3],
      summary: this.generatePatternSummary(patterns)
    };
  }

  /**
   * Get pattern-based category suggestions
   */
  async getPatternBasedSuggestions(transaction, options = {}) {
    const { topN = 3, minConfidence = 0.7 } = options;
    
    const patterns = await this.detectPatterns(transaction);
    const suggestions = [];

    // Recurring pattern suggestions
    if (patterns.recurring.isRecurring && patterns.recurring.confidence >= minConfidence) {
      suggestions.push({
        category: patterns.recurring.suggestedCategory,
        confidence: patterns.recurring.confidence,
        type: 'recurring',
        reasoning: patterns.recurring.reasoning,
        evidence: patterns.recurring.evidence
      });
    }

    // Seasonal pattern suggestions
    if (patterns.seasonal.hasSeasonalPattern && patterns.seasonal.confidence >= minConfidence) {
      suggestions.push({
        category: patterns.seasonal.suggestedCategory,
        confidence: patterns.seasonal.confidence,
        type: 'seasonal',
        reasoning: patterns.seasonal.reasoning,
        evidence: patterns.seasonal.evidence
      });
    }

    // Behavioral pattern suggestions
    patterns.behavioral.patterns.forEach(pattern => {
      if (pattern.confidence >= minConfidence) {
        suggestions.push({
          category: pattern.suggestedCategory,
          confidence: pattern.confidence,
          type: 'behavioral',
          reasoning: pattern.reasoning,
          evidence: pattern.evidence
        });
      }
    });

    // Temporal pattern suggestions
    if (patterns.temporal.hasPattern && patterns.temporal.confidence >= minConfidence) {
      suggestions.push({
        category: patterns.temporal.suggestedCategory,
        confidence: patterns.temporal.confidence,
        type: 'temporal',
        reasoning: patterns.temporal.reasoning,
        evidence: patterns.temporal.evidence
      });
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN);
  }

  async getHistoricalData() {
    return await db.transactions.orderBy('date').reverse().limit(1000).toArray();
  }

  generatePatternSummary(patterns) {
    const summary = [];
    
    if (patterns[0].isRecurring) {
      summary.push(`Wiederkehrende Zahlung erkannt (${Math.round(patterns[0].confidence * 100)}%)`);
    }
    
    if (patterns[1].hasSeasonalPattern) {
      summary.push(`Saisonales Muster erkannt (${patterns[1].seasonType})`);
    }
    
    if (patterns[2].patterns.length > 0) {
      summary.push(`${patterns[2].patterns.length} Verhaltensmuster gefunden`);
    }
    
    if (patterns[3].hasPattern) {
      summary.push(`Zeitliches Muster erkannt (${patterns[3].patternType})`);
    }

    return summary;
  }
}

class RecurringPaymentDetector {
  constructor() {
    this.minOccurrences = 3;
    this.maxDayVariance = 5; // days
    this.maxAmountVariance = 0.05; // 5%
  }

  async detect(transaction, historicalData) {
    const amount = Math.abs(transaction.amount);
    const recipient = (transaction.recipient || '').toLowerCase();
    
    if (!recipient) {
      return { isRecurring: false, confidence: 0 };
    }

    // Find similar transactions
    const similarTransactions = historicalData.filter(tx => {
      const txRecipient = (tx.recipient || '').toLowerCase();
      const txAmount = Math.abs(tx.amount);
      
      return this.isSimilarRecipient(recipient, txRecipient) &&
             this.isSimilarAmount(amount, txAmount);
    });

    if (similarTransactions.length < this.minOccurrences) {
      return { isRecurring: false, confidence: 0 };
    }

    // Check for regular intervals
    const intervals = this.calculateIntervals(similarTransactions);
    const recurringPattern = this.analyzeIntervals(intervals);

    if (!recurringPattern.isRegular) {
      return { isRecurring: false, confidence: 0 };
    }

    // Determine category based on historical data
    const categoryCount = {};
    similarTransactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    const mostCommonCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    return {
      isRecurring: true,
      confidence: this.calculateRecurringConfidence(recurringPattern, similarTransactions.length),
      suggestedCategory: mostCommonCategory,
      interval: recurringPattern.averageInterval,
      intervalType: this.classifyInterval(recurringPattern.averageInterval),
      lastOccurrence: similarTransactions[0].date,
      occurrenceCount: similarTransactions.length,
      reasoning: this.generateRecurringReasoning(recurringPattern, similarTransactions.length),
      evidence: {
        similarTransactions: similarTransactions.length,
        averageInterval: Math.round(recurringPattern.averageInterval),
        intervalVariance: Math.round(recurringPattern.variance),
        amountConsistency: this.calculateAmountConsistency(similarTransactions)
      }
    };
  }

  isSimilarRecipient(recipient1, recipient2) {
    if (recipient1 === recipient2) return true;
    
    // Check for substantial overlap
    const tokens1 = recipient1.split(/\s+/);
    const tokens2 = recipient2.split(/\s+/);
    
    const overlap = tokens1.filter(token => 
      tokens2.some(t2 => t2.includes(token) || token.includes(t2))
    ).length;
    
    return overlap >= Math.min(tokens1.length, tokens2.length) * 0.7;
  }

  isSimilarAmount(amount1, amount2) {
    if (amount1 === amount2) return true;
    
    const diff = Math.abs(amount1 - amount2);
    const maxAmount = Math.max(amount1, amount2);
    
    return diff / maxAmount <= this.maxAmountVariance;
  }

  calculateIntervals(transactions) {
    if (transactions.length < 2) return [];
    
    const sortedTx = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const intervals = [];
    
    for (let i = 1; i < sortedTx.length; i++) {
      const daysDiff = (new Date(sortedTx[i].date) - new Date(sortedTx[i-1].date)) / (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }
    
    return intervals;
  }

  analyzeIntervals(intervals) {
    if (intervals.length === 0) {
      return { isRegular: false, averageInterval: 0, variance: 0 };
    }

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / intervals.length;
    
    // Consider regular if variance is small relative to average
    const isRegular = Math.sqrt(variance) <= this.maxDayVariance;
    
    return {
      isRegular,
      averageInterval,
      variance
    };
  }

  classifyInterval(averageInterval) {
    if (averageInterval >= 28 && averageInterval <= 32) return 'monthly';
    if (averageInterval >= 6 && averageInterval <= 8) return 'weekly';
    if (averageInterval >= 13 && averageInterval <= 15) return 'biweekly';
    if (averageInterval >= 90 && averageInterval <= 95) return 'quarterly';
    if (averageInterval >= 365 && averageInterval <= 370) return 'yearly';
    return 'custom';
  }

  calculateRecurringConfidence(pattern, occurrenceCount) {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for more occurrences
    confidence += Math.min(occurrenceCount / 10, 0.3);
    
    // Higher confidence for lower variance
    const normalizedVariance = Math.min(pattern.variance / 100, 1);
    confidence += (1 - normalizedVariance) * 0.2;
    
    return Math.min(confidence, 0.98);
  }

  calculateAmountConsistency(transactions) {
    if (transactions.length === 0) return 0;
    
    const amounts = transactions.map(tx => Math.abs(tx.amount));
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - avgAmount, 2), 0) / amounts.length;
    
    return 1 - Math.min(Math.sqrt(variance) / avgAmount, 1);
  }

  generateRecurringReasoning(pattern, count) {
    const intervalType = this.classifyInterval(pattern.averageInterval);
    return `${count} ähnliche Transaktionen mit ${intervalType === 'custom' ? 'regelmäßigem' : intervalType} Intervall gefunden. ` +
           `Durchschnittlich alle ${Math.round(pattern.averageInterval)} Tage.`;
  }
}

class SeasonalPatternDetector {
  constructor() {
    this.seasonMap = {
      'winter': [11, 0, 1], // Dec, Jan, Feb
      'spring': [2, 3, 4],  // Mar, Apr, May
      'summer': [5, 6, 7],  // Jun, Jul, Aug
      'autumn': [8, 9, 10]  // Sep, Oct, Nov
    };
  }

  async detect(transaction, historicalData) {
    const txDate = new Date(transaction.date);
    const txMonth = txDate.getMonth();
    const txSeason = this.getSeason(txMonth);
    
    const recipient = (transaction.recipient || '').toLowerCase();
    const amount = Math.abs(transaction.amount);

    // Find historical transactions from same season
    const seasonalTransactions = historicalData.filter(tx => {
      const month = new Date(tx.date).getMonth();
      const season = this.getSeason(month);
      
      return season === txSeason && 
             this.isSimilarContext(transaction, tx);
    });

    if (seasonalTransactions.length < 2) {
      return { hasSeasonalPattern: false, confidence: 0 };
    }

    // Check if this type of transaction is significantly more common in this season
    const allYearTransactions = historicalData.filter(tx => 
      this.isSimilarContext(transaction, tx)
    );

    const seasonalRatio = seasonalTransactions.length / Math.max(allYearTransactions.length, 1);
    
    if (seasonalRatio < 0.6) { // Less than 60% in this season
      return { hasSeasonalPattern: false, confidence: 0 };
    }

    const mostCommonCategory = this.getMostCommonCategory(seasonalTransactions);
    
    return {
      hasSeasonalPattern: true,
      confidence: Math.min(seasonalRatio + 0.2, 0.95),
      seasonType: txSeason,
      suggestedCategory: mostCommonCategory,
      reasoning: this.generateSeasonalReasoning(txSeason, seasonalTransactions.length, allYearTransactions.length),
      evidence: {
        seasonalOccurrences: seasonalTransactions.length,
        totalOccurrences: allYearTransactions.length,
        seasonalRatio: Math.round(seasonalRatio * 100)
      }
    };
  }

  getSeason(month) {
    for (const [season, months] of Object.entries(this.seasonMap)) {
      if (months.includes(month)) {
        return season;
      }
    }
    return 'unknown';
  }

  isSimilarContext(tx1, tx2) {
    // Simple context matching - can be enhanced
    const recipient1 = (tx1.recipient || '').toLowerCase();
    const recipient2 = (tx2.recipient || '').toLowerCase();
    
    return recipient1.includes(recipient2.split(' ')[0]) || 
           recipient2.includes(recipient1.split(' ')[0]);
  }

  getMostCommonCategory(transactions) {
    const categoryCount = {};
    transactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
  }

  generateSeasonalReasoning(season, seasonalCount, totalCount) {
    const percentage = Math.round((seasonalCount / totalCount) * 100);
    const seasonNames = {
      winter: 'Winter',
      spring: 'Frühling', 
      summer: 'Sommer',
      autumn: 'Herbst'
    };
    
    return `${percentage}% ähnlicher Transaktionen treten im ${seasonNames[season]} auf (${seasonalCount} von ${totalCount}).`;
  }
}

class BehavioralPatternDetector {
  async detect(transaction, historicalData) {
    const patterns = [];
    
    // Day of week pattern
    const dayOfWeekPattern = await this.detectDayOfWeekPattern(transaction, historicalData);
    if (dayOfWeekPattern.hasPattern) {
      patterns.push(dayOfWeekPattern);
    }

    // Time of month pattern
    const timeOfMonthPattern = await this.detectTimeOfMonthPattern(transaction, historicalData);
    if (timeOfMonthPattern.hasPattern) {
      patterns.push(timeOfMonthPattern);
    }

    // Amount range pattern
    const amountRangePattern = await this.detectAmountRangePattern(transaction, historicalData);
    if (amountRangePattern.hasPattern) {
      patterns.push(amountRangePattern);
    }

    return { patterns };
  }

  async detectDayOfWeekPattern(transaction, historicalData) {
    const txDayOfWeek = new Date(transaction.date).getDay();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    
    const sameDayTransactions = historicalData.filter(tx => 
      new Date(tx.date).getDay() === txDayOfWeek
    );

    if (sameDayTransactions.length < 3) {
      return { hasPattern: false };
    }

    const categoryCount = {};
    sameDayTransactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    const mostCommonCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];

    if (!mostCommonCategory || mostCommonCategory[1] < 2) {
      return { hasPattern: false };
    }

    const confidence = mostCommonCategory[1] / sameDayTransactions.length;
    
    return {
      hasPattern: confidence > 0.6,
      suggestedCategory: mostCommonCategory[0],
      confidence: Math.min(confidence + 0.2, 0.9),
      reasoning: `Am ${dayNames[txDayOfWeek]} werden oft "${mostCommonCategory[0]}" Transaktionen durchgeführt (${mostCommonCategory[1]} von ${sameDayTransactions.length}).`,
      evidence: {
        dayOfWeek: dayNames[txDayOfWeek],
        categoryOccurrences: mostCommonCategory[1],
        totalDayOccurrences: sameDayTransactions.length
      }
    };
  }

  async detectTimeOfMonthPattern(transaction, historicalData) {
    const txDay = new Date(transaction.date).getDate();
    let timeCategory;
    
    if (txDay <= 5) timeCategory = 'beginning';
    else if (txDay <= 25) timeCategory = 'middle';
    else timeCategory = 'end';

    const sameTimeTransactions = historicalData.filter(tx => {
      const day = new Date(tx.date).getDate();
      if (timeCategory === 'beginning') return day <= 5;
      if (timeCategory === 'middle') return day > 5 && day <= 25;
      return day > 25;
    });

    if (sameTimeTransactions.length < 5) {
      return { hasPattern: false };
    }

    const categoryCount = {};
    sameTimeTransactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    const mostCommonCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];

    if (!mostCommonCategory || mostCommonCategory[1] < 3) {
      return { hasPattern: false };
    }

    const confidence = mostCommonCategory[1] / sameTimeTransactions.length;
    const timeNames = { beginning: 'Monatsanfang', middle: 'Monatsmitte', end: 'Monatsende' };

    return {
      hasPattern: confidence > 0.4,
      suggestedCategory: mostCommonCategory[0],
      confidence: Math.min(confidence + 0.3, 0.85),
      reasoning: `Am ${timeNames[timeCategory]} werden oft "${mostCommonCategory[0]}" Transaktionen durchgeführt.`,
      evidence: {
        timeOfMonth: timeNames[timeCategory],
        categoryOccurrences: mostCommonCategory[1],
        totalTimeOccurrences: sameTimeTransactions.length
      }
    };
  }

  async detectAmountRangePattern(transaction, historicalData) {
    const amount = Math.abs(transaction.amount);
    let rangeCategory;
    
    if (amount < 10) rangeCategory = 'small';
    else if (amount < 100) rangeCategory = 'medium';
    else if (amount < 500) rangeCategory = 'large';
    else rangeCategory = 'very_large';

    const sameRangeTransactions = historicalData.filter(tx => {
      const txAmount = Math.abs(tx.amount);
      if (rangeCategory === 'small') return txAmount < 10;
      if (rangeCategory === 'medium') return txAmount >= 10 && txAmount < 100;
      if (rangeCategory === 'large') return txAmount >= 100 && txAmount < 500;
      return txAmount >= 500;
    });

    if (sameRangeTransactions.length < 5) {
      return { hasPattern: false };
    }

    const categoryCount = {};
    sameRangeTransactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    const mostCommonCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];

    if (!mostCommonCategory || mostCommonCategory[1] < 3) {
      return { hasPattern: false };
    }

    const confidence = mostCommonCategory[1] / sameRangeTransactions.length;
    const rangeNames = { 
      small: 'kleine Beträge (<10€)', 
      medium: 'mittlere Beträge (10-100€)',
      large: 'große Beträge (100-500€)',
      very_large: 'sehr große Beträge (>500€)'
    };

    return {
      hasPattern: confidence > 0.3,
      suggestedCategory: mostCommonCategory[0],
      confidence: Math.min(confidence + 0.2, 0.8),
      reasoning: `Bei ${rangeNames[rangeCategory]} wird oft die Kategorie "${mostCommonCategory[0]}" verwendet.`,
      evidence: {
        amountRange: rangeNames[rangeCategory],
        categoryOccurrences: mostCommonCategory[1],
        totalRangeOccurrences: sameRangeTransactions.length
      }
    };
  }
}

class TemporalPatternDetector {
  async detect(transaction, historicalData) {
    // Look for time-based patterns like end-of-month, beginning-of-month, etc.
    const txDate = new Date(transaction.date);
    const dayOfMonth = txDate.getDate();
    
    let pattern = null;
    
    // End of month pattern (last 3 days)
    if (this.isEndOfMonth(txDate)) {
      pattern = await this.detectEndOfMonthPattern(transaction, historicalData);
    }
    
    // Beginning of month pattern (first 3 days)
    else if (dayOfMonth <= 3) {
      pattern = await this.detectBeginningOfMonthPattern(transaction, historicalData);
    }
    
    // Payday pattern (around 15th and 30th)
    else if (Math.abs(dayOfMonth - 15) <= 2 || dayOfMonth >= 28) {
      pattern = await this.detectPaydayPattern(transaction, historicalData);
    }

    return pattern || { hasPattern: false, confidence: 0 };
  }

  isEndOfMonth(date) {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    return nextDay.getMonth() !== date.getMonth() || date.getDate() >= 28;
  }

  async detectEndOfMonthPattern(transaction, historicalData) {
    const endOfMonthTx = historicalData.filter(tx => {
      const date = new Date(tx.date);
      return this.isEndOfMonth(date);
    });

    return this.analyzeTemporalPattern(transaction, endOfMonthTx, 'end-of-month', 'Monatsende');
  }

  async detectBeginningOfMonthPattern(transaction, historicalData) {
    const beginningOfMonthTx = historicalData.filter(tx => {
      const date = new Date(tx.date);
      return date.getDate() <= 3;
    });

    return this.analyzeTemporalPattern(transaction, beginningOfMonthTx, 'beginning-of-month', 'Monatsanfang');
  }

  async detectPaydayPattern(transaction, historicalData) {
    const paydayTx = historicalData.filter(tx => {
      const day = new Date(tx.date).getDate();
      return Math.abs(day - 15) <= 2 || day >= 28;
    });

    return this.analyzeTemporalPattern(transaction, paydayTx, 'payday', 'Zahltag');
  }

  analyzeTemporalPattern(transaction, temporalTransactions, patternType, patternName) {
    if (temporalTransactions.length < 3) {
      return { hasPattern: false };
    }

    const categoryCount = {};
    temporalTransactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    const mostCommonCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];

    if (!mostCommonCategory || mostCommonCategory[1] < 2) {
      return { hasPattern: false };
    }

    const confidence = mostCommonCategory[1] / temporalTransactions.length;

    return {
      hasPattern: confidence > 0.4,
      patternType,
      suggestedCategory: mostCommonCategory[0],
      confidence: Math.min(confidence + 0.3, 0.9),
      reasoning: `Am ${patternName} werden oft "${mostCommonCategory[0]}" Transaktionen durchgeführt (${mostCommonCategory[1]} von ${temporalTransactions.length}).`,
      evidence: {
        temporalContext: patternName,
        categoryOccurrences: mostCommonCategory[1],
        totalTemporalOccurrences: temporalTransactions.length,
        patternStrength: Math.round(confidence * 100)
      }
    };
  }
}

export const smartPatternDetector = new SmartPatternDetector();