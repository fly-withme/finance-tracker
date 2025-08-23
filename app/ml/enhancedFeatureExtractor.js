/**
 * Enhanced Feature Extractor for Smart Transaction Categorization
 * Extracts advanced features from transactions for better ML predictions
 */

export class EnhancedFeatureExtractor {
  constructor() {
    this.commonMerchants = new Map();
    this.amountBins = [5, 10, 25, 50, 100, 250, 500, 1000];
    this.stopWords = new Set(['der', 'die', 'das', 'und', 'oder', 'bei', 'von', 'zu', 'mit', 'für']);
  }

  /**
   * Extract comprehensive features from a transaction
   */
  async extractFeatures(transaction, historicalData = null) {
    const features = {
      // Basic features
      ...this.extractBasicFeatures(transaction),
      
      // Temporal features
      ...this.extractTemporalFeatures(transaction),
      
      // Amount features  
      ...this.extractAmountFeatures(transaction),
      
      // Text features
      ...this.extractTextFeatures(transaction),
      
      // Historical features (if historical data provided)
      ...(historicalData && await this.extractHistoricalFeatures(transaction, historicalData))
    };

    return features;
  }

  extractBasicFeatures(transaction) {
    return {
      amount: Math.abs(transaction.amount),
      isIncome: transaction.amount > 0,
      isExpense: transaction.amount < 0,
      hasRecipient: Boolean(transaction.recipient && transaction.recipient.length > 0),
      hasDescription: Boolean(transaction.description && transaction.description.length > 0),
      account: transaction.account || 'unknown'
    };
  }

  extractTemporalFeatures(transaction) {
    const date = new Date(transaction.date);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const month = date.getMonth();
    const hour = date.getHours();

    return {
      dayOfWeek,
      isWeekend: [0, 6].includes(dayOfWeek),
      isMonthStart: dayOfMonth <= 5,
      isMonthMiddle: dayOfMonth > 5 && dayOfMonth <= 25,
      isMonthEnd: dayOfMonth > 25,
      month,
      quarter: Math.floor(month / 3),
      isBusinessHour: hour >= 9 && hour <= 17,
      isEvening: hour >= 18 && hour <= 23,
      isMorning: hour >= 6 && hour <= 11
    };
  }

  extractAmountFeatures(transaction) {
    const amount = Math.abs(transaction.amount);
    
    return {
      amountBin: this.categorizeAmount(amount),
      isRoundAmount: amount % 1 === 0,
      isSmallAmount: amount < 10,
      isMediumAmount: amount >= 10 && amount <= 100,
      isLargeAmount: amount > 100,
      amountDigitCount: Math.floor(Math.log10(amount)) + 1,
      endsInZero: amount % 10 === 0,
      endsInFive: amount % 5 === 0 && amount % 10 !== 0
    };
  }

  extractTextFeatures(transaction) {
    const recipient = (transaction.recipient || '').toLowerCase();
    const description = (transaction.description || '').toLowerCase();
    const fullText = `${recipient} ${description}`.toLowerCase();

    return {
      // Recipient features
      recipientLength: recipient.length,
      recipientWordCount: recipient.split(' ').filter(w => w.length > 0).length,
      hasGmbH: /\bgmbh\b/.test(recipient),
      hasAG: /\bag\b/.test(recipient),
      hasLtd: /\bltd\b/.test(recipient),
      
      // Description features
      descriptionLength: description.length,
      descriptionWordCount: description.split(' ').filter(w => w.length > 0).length,
      
      // Payment method indicators
      isPayPal: /paypal/i.test(fullText),
      isKlarna: /klarna/i.test(fullText),
      isCard: /card|karte/i.test(fullText),
      isDirectDebit: /lastschrift/i.test(fullText),
      isTransfer: /überweisung|ueberweisung/i.test(fullText),
      
      // Business type indicators
      isOnlineShop: this.isOnlineShop(fullText),
      isRestaurant: this.isRestaurant(fullText),
      isSupermarket: this.isSupermarket(fullText),
      isGasStation: this.isGasStation(fullText),
      isSubscription: this.isSubscription(fullText),
      isInsurance: this.isInsurance(fullText),
      isUtility: this.isUtility(fullText),
      
      // Text tokens (for similarity matching)
      tokens: this.tokenize(fullText),
      significantTokens: this.extractSignificantTokens(fullText)
    };
  }

  async extractHistoricalFeatures(transaction, historicalData) {
    const recipient = (transaction.recipient || '').toLowerCase();
    const amount = Math.abs(transaction.amount);
    
    // Find similar merchants
    const merchantHistory = historicalData.filter(tx => 
      (tx.recipient || '').toLowerCase().includes(recipient.split(' ')[0]) ||
      recipient.includes((tx.recipient || '').toLowerCase().split(' ')[0])
    );

    // Find similar amounts
    const amountHistory = historicalData.filter(tx => 
      Math.abs(Math.abs(tx.amount) - amount) < amount * 0.1
    );

    return {
      merchantFrequency: merchantHistory.length,
      merchantLastSeen: merchantHistory.length > 0 ? 
        this.daysSince(merchantHistory[merchantHistory.length - 1].date) : -1,
      merchantMostCommonCategory: this.getMostCommonCategory(merchantHistory),
      merchantAverageAmount: merchantHistory.length > 0 ?
        merchantHistory.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / merchantHistory.length : 0,
      
      amountFrequency: amountHistory.length,
      amountMostCommonCategory: this.getMostCommonCategory(amountHistory),
      
      // User behavior patterns
      userMostActiveDay: this.getUserMostActiveDay(historicalData),
      userAverageTransactionAmount: this.getAverageAmount(historicalData),
      userTopCategories: this.getTopCategories(historicalData, 5)
    };
  }

  // Helper methods

  categorizeAmount(amount) {
    for (let i = 0; i < this.amountBins.length; i++) {
      if (amount <= this.amountBins[i]) {
        return i;
      }
    }
    return this.amountBins.length;
  }

  isOnlineShop(text) {
    const patterns = [/amazon/i, /ebay/i, /zalando/i, /otto/i, /online/i, /shop/i, /store/i];
    return patterns.some(pattern => pattern.test(text));
  }

  isRestaurant(text) {
    const patterns = [/restaurant/i, /pizza/i, /burger/i, /mcdonalds/i, /kfc/i, /subway/i, /lieferando/i, /deliveroo/i];
    return patterns.some(pattern => pattern.test(text));
  }

  isSupermarket(text) {
    const patterns = [/rewe/i, /edeka/i, /aldi/i, /lidl/i, /kaufland/i, /real/i, /netto/i, /penny/i];
    return patterns.some(pattern => pattern.test(text));
  }

  isGasStation(text) {
    const patterns = [/shell/i, /aral/i, /esso/i, /bp/i, /jet/i, /tankstelle/i, /tankstell/i];
    return patterns.some(pattern => pattern.test(text));
  }

  isSubscription(text) {
    const patterns = [/netflix/i, /spotify/i, /amazon prime/i, /abo/i, /subscription/i, /monatlich/i];
    return patterns.some(pattern => pattern.test(text));
  }

  isInsurance(text) {
    const patterns = [/versicherung/i, /allianz/i, /axa/i, /ergo/i, /huk/i, /insurance/i];
    return patterns.some(pattern => pattern.test(text));
  }

  isUtility(text) {
    const patterns = [/stadtwerke/i, /energie/i, /strom/i, /gas/i, /wasser/i, /telefon/i, /internet/i, /telekom/i, /vodafone/i];
    return patterns.some(pattern => pattern.test(text));
  }

  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token));
  }

  extractSignificantTokens(text) {
    const tokens = this.tokenize(text);
    // Return tokens that are likely to be meaningful (longer than 3 chars, not numbers)
    return tokens.filter(token => 
      token.length > 3 && 
      !/^\d+$/.test(token) &&
      !this.stopWords.has(token)
    );
  }

  daysSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
  }

  getMostCommonCategory(transactions) {
    if (transactions.length === 0) return null;
    
    const categoryCount = {};
    transactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;
  }

  getUserMostActiveDay(transactions) {
    const dayCount = new Array(7).fill(0);
    transactions.forEach(tx => {
      const day = new Date(tx.date).getDay();
      dayCount[day]++;
    });
    
    return dayCount.indexOf(Math.max(...dayCount));
  }

  getAverageAmount(transactions) {
    if (transactions.length === 0) return 0;
    return transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / transactions.length;
  }

  getTopCategories(transactions, limit = 5) {
    const categoryCount = {};
    transactions.forEach(tx => {
      if (tx.category) {
        categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
      }
    });

    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([category, count]) => ({ category, count }));
  }

  /**
   * Calculate feature similarity between two transactions
   */
  calculateFeatureSimilarity(features1, features2) {
    let totalScore = 0;
    let featureCount = 0;

    // Compare numerical features
    const numericalFeatures = [
      'amount', 'dayOfWeek', 'month', 'amountBin', 
      'recipientLength', 'descriptionLength', 'merchantFrequency'
    ];

    numericalFeatures.forEach(feature => {
      if (features1[feature] !== undefined && features2[feature] !== undefined) {
        const diff = Math.abs(features1[feature] - features2[feature]);
        const maxVal = Math.max(features1[feature], features2[feature], 1);
        const similarity = 1 - (diff / maxVal);
        totalScore += similarity;
        featureCount++;
      }
    });

    // Compare boolean features
    const booleanFeatures = [
      'isIncome', 'isExpense', 'isWeekend', 'isRoundAmount', 
      'isPayPal', 'isOnlineShop', 'isRestaurant', 'isSupermarket'
    ];

    booleanFeatures.forEach(feature => {
      if (features1[feature] !== undefined && features2[feature] !== undefined) {
        totalScore += features1[feature] === features2[feature] ? 1 : 0;
        featureCount++;
      }
    });

    // Compare token similarity
    if (features1.tokens && features2.tokens) {
      const tokenSimilarity = this.calculateTokenSimilarity(features1.tokens, features2.tokens);
      totalScore += tokenSimilarity;
      featureCount++;
    }

    return featureCount > 0 ? totalScore / featureCount : 0;
  }

  calculateTokenSimilarity(tokens1, tokens2) {
    if (tokens1.length === 0 && tokens2.length === 0) return 1;
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
}

export const featureExtractor = new EnhancedFeatureExtractor();