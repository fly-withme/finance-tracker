export class TransactionClassifier {
  constructor(initialModel = {}) {
    // Store learned patterns with confidence scores
    this.patterns = new Map(Object.entries(initialModel));
    this.stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'an', 'zu', 'für', 'von', 'mit', 'bei'
    ]);
  }

  // Extract meaningful keywords from transaction description
  extractKeywords(description) {
    if (!description) return [];
    
    const normalized = description.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
    
    const words = normalized.split(' ')
      .filter(word => word.length > 2)        // Remove very short words
      .filter(word => !this.stopWords.has(word))  // Remove stop words
      .filter(word => !/^\d+$/.test(word));   // Remove pure numbers
    
    // Create n-grams (combinations of 1-3 words)
    const keywords = [];
    
    // Single words
    keywords.push(...words);
    
    // Bigrams (2-word combinations)
    for (let i = 0; i < words.length - 1; i++) {
      keywords.push(`${words[i]} ${words[i + 1]}`);
    }
    
    // Trigrams (3-word combinations) for longer descriptions
    if (words.length >= 3) {
      for (let i = 0; i < words.length - 2; i++) {
        keywords.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
    
    return keywords;
  }

  // Predict category for a transaction
  predictCategory(description) {
    if (!description) return null;
    
    const keywords = this.extractKeywords(description);
    const categoryScores = new Map();
    
    // Calculate scores for each category based on learned patterns
    for (const keyword of keywords) {
      const exactMatch = this.patterns.get(keyword);
      if (exactMatch) {
        const score = categoryScores.get(exactMatch.category) || 0;
        categoryScores.set(exactMatch.category, score + exactMatch.confidence);
      }
      
      // Also check for partial matches
      for (const [pattern, data] of this.patterns.entries()) {
        if (pattern.includes(keyword) || keyword.includes(pattern)) {
          const score = categoryScores.get(data.category) || 0;
          categoryScores.set(data.category, score + (data.confidence * 0.5)); // Lower weight for partial matches
        }
      }
    }
    
    // Return the category with highest score if above threshold
    let bestCategory = null;
    let bestScore = 0;
    
    for (const [category, score] of categoryScores.entries()) {
      if (score > bestScore && score >= 0.3) { // Confidence threshold
        bestCategory = category;
        bestScore = score;
      }
    }
    
    return {
      category: bestCategory,
      confidence: bestScore
    };
  }

  // Learn from user feedback
  learn(description, correctCategory) {
    if (!description || !correctCategory) return;
    
    const keywords = this.extractKeywords(description);
    
    // Update patterns with new learning
    for (const keyword of keywords) {
      const existing = this.patterns.get(keyword);
      
      if (existing) {
        if (existing.category === correctCategory) {
          // Reinforce correct prediction
          existing.confidence = Math.min(1.0, existing.confidence + 0.1);
        } else {
          // Reduce confidence in wrong prediction
          existing.confidence = Math.max(0.1, existing.confidence - 0.2);
          
          // If confidence is too low, replace with correct category
          if (existing.confidence < 0.3) {
            this.patterns.set(keyword, {
              category: correctCategory,
              confidence: 0.5
            });
          }
        }
      } else {
        // New pattern
        this.patterns.set(keyword, {
          category: correctCategory,
          confidence: 0.6
        });
      }
    }
    
    // Clean up very low confidence patterns
    for (const [pattern, data] of this.patterns.entries()) {
      if (data.confidence < 0.1) {
        this.patterns.delete(pattern);
      }
    }
  }

  // Get current model state for persistence
  getModel() {
    const model = {};
    for (const [pattern, data] of this.patterns.entries()) {
      model[pattern] = data;
    }
    return model;
  }

  // Load model from saved state
  loadModel(modelData) {
    this.patterns.clear();
    for (const [pattern, data] of Object.entries(modelData)) {
      this.patterns.set(pattern, data);
    }
  }

  // Get learning statistics
  getStats() {
    const categories = new Map();
    let totalPatterns = 0;
    
    for (const [pattern, data] of this.patterns.entries()) {
      totalPatterns++;
      const count = categories.get(data.category) || 0;
      categories.set(data.category, count + 1);
    }
    
    return {
      totalPatterns,
      categoriesLearned: categories.size,
      categoryBreakdown: Object.fromEntries(categories.entries())
    };
  }

  // Get category suggestions based on learned patterns
  getCategorySuggestions(description, availableCategories, limit = 3) {
    if (!description) return [];
    
    const keywords = this.extractKeywords(description);
    const categoryScores = new Map();
    
    // Calculate scores for each category based on learned patterns
    for (const keyword of keywords) {
      for (const [pattern, data] of this.patterns.entries()) {
        // Check for exact matches and partial matches
        const isExactMatch = pattern === keyword;
        const isPartialMatch = pattern.includes(keyword) || keyword.includes(pattern);
        
        if (isExactMatch || isPartialMatch) {
          const weight = isExactMatch ? 1.0 : 0.5;
          const score = categoryScores.get(data.category) || 0;
          categoryScores.set(data.category, score + (data.confidence * weight));
        }
      }
    }
    
    // Filter to only available categories and sort by score
    const suggestions = Array.from(categoryScores.entries())
      .filter(([categoryName]) => 
        availableCategories.some(cat => cat.name === categoryName)
      )
      .sort((a, b) => b[1] - a[1]) // Sort by score descending
      .slice(0, limit)
      .map(([categoryName, score]) => ({
        category: availableCategories.find(cat => cat.name === categoryName),
        confidence: Math.min(1.0, score)
      }))
      .filter(suggestion => suggestion.confidence > 0.2); // Only show meaningful suggestions
    
    return suggestions;
  }
}

// Pre-trained patterns for common transaction types
export const getInitialModel = () => ({
  // Income patterns
  'salary': { category: 'Income', confidence: 0.9 },
  'wage': { category: 'Income', confidence: 0.9 },
  'freelance': { category: 'Income', confidence: 0.8 },
  'bonus': { category: 'Income', confidence: 0.8 },
  'gehalt': { category: 'Income', confidence: 0.9 },
  'lohn': { category: 'Income', confidence: 0.9 },
  
  // Food & Dining
  'restaurant': { category: 'Food & Drink', confidence: 0.8 },
  'cafe': { category: 'Food & Drink', confidence: 0.8 },
  'mcdonald': { category: 'Food & Drink', confidence: 0.9 },
  'burger': { category: 'Food & Drink', confidence: 0.7 },
  'pizza': { category: 'Food & Drink', confidence: 0.8 },
  'starbucks': { category: 'Food & Drink', confidence: 0.8 },
  
  // Groceries
  'supermarket': { category: 'Groceries', confidence: 0.9 },
  'grocery': { category: 'Groceries', confidence: 0.9 },
  'rewe': { category: 'Groceries', confidence: 0.9 },
  'edeka': { category: 'Groceries', confidence: 0.9 },
  'aldi': { category: 'Groceries', confidence: 0.9 },
  'lidl': { category: 'Groceries', confidence: 0.9 },
  
  // Transportation
  'uber': { category: 'Transportation', confidence: 0.9 },
  'taxi': { category: 'Transportation', confidence: 0.8 },
  'gas station': { category: 'Transportation', confidence: 0.8 },
  'tankstelle': { category: 'Transportation', confidence: 0.8 },
  'bahn': { category: 'Transportation', confidence: 0.8 },
  'train': { category: 'Transportation', confidence: 0.8 },
  
  // Entertainment
  'netflix': { category: 'Entertainment', confidence: 0.9 },
  'spotify': { category: 'Entertainment', confidence: 0.9 },
  'cinema': { category: 'Entertainment', confidence: 0.8 },
  'kino': { category: 'Entertainment', confidence: 0.8 },
  'theater': { category: 'Entertainment', confidence: 0.8 },
  
  // Housing
  'rent': { category: 'Housing', confidence: 0.9 },
  'miete': { category: 'Housing', confidence: 0.9 },
  'mortgage': { category: 'Housing', confidence: 0.9 },
  'insurance': { category: 'Housing', confidence: 0.7 },
  'versicherung': { category: 'Housing', confidence: 0.7 },
  
  // Utilities
  'electric': { category: 'Utilities', confidence: 0.8 },
  'gas bill': { category: 'Utilities', confidence: 0.8 },
  'water': { category: 'Utilities', confidence: 0.8 },
  'internet': { category: 'Utilities', confidence: 0.8 },
  'phone': { category: 'Utilities', confidence: 0.7 },
  'strom': { category: 'Utilities', confidence: 0.8 },
  
  // Shopping
  'amazon': { category: 'Shopping', confidence: 0.8 },
  'ebay': { category: 'Shopping', confidence: 0.8 },
  'zalando': { category: 'Shopping', confidence: 0.8 },
  'clothing': { category: 'Shopping', confidence: 0.7 },
  'online shop': { category: 'Shopping', confidence: 0.7 }
});