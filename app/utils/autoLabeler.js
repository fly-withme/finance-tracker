// Smart auto-labeling system for transactions
export class AutoLabeler {
  constructor() {
    this.rules = [
      // Supermarkets & Food
      {
        patterns: [
          // German supermarkets - all variants
          /rewe|aldi|aldis|aldi süd|aldi nord/i,
          /edeka|netto|penny|kaufland|real/i,
          /lidl|norma|famila|markant/i,
          /combi|hit|globus|tegut/i,
          // Fresh food
          /alfrisch|frisch|fresh|bio|organic/i,
          // General food terms
          /supermarkt|markt|food|lebensmittel|groceries/i,
          // Restaurants & fast food
          /mcdonald|burger king|kfc|subway|pizza|döner/i,
          /restaurant|cafe|bistro|bäcker|metzger|fleisch/i,
          // Other food merchants
          /coors.*bäcker|dankt.*food/i
        ],
        category: 'Food & Groceries',
        confidence: 0.9
      },
      
      // Transportation
      {
        patterns: [
          /tankstelle|shell|esso|aral|jet|total/i,
          /db |deutsche bahn|hvv|mvv|vgn|vrr/i,
          /taxi|uber|bolt|miles|sixt/i,
          /parking|parkhaus|parkschein/i
        ],
        category: 'Transportation',
        confidence: 0.9
      },
      
      // Housing & Utilities
      {
        patterns: [
          /miete|wohnung|nebenkosten|hausgeld/i,
          /stadtwerke|energie|gas|strom|wasser/i,
          /internet|telekom|vodafone|o2|1und1/i,
          /versicherung|insurance|haftpflicht/i
        ],
        category: 'Housing & Utilities',
        confidence: 0.95
      },
      
      // Healthcare & Fitness
      {
        patterns: [
          /apotheke|pharmacy|arzt|zahnarzt/i,
          /fitness|gym|sport|mcfit|clever fit|benefit fitness/i,
          /medizin|medicine|behandlung/i
        ],
        category: 'Health & Fitness',
        confidence: 0.9
      },
      
      // Insurance
      {
        patterns: [
          /krankenkasse|techniker|barmer|aok|dak/i,
          /versicherung|insurance|haftpflicht|kasko/i,
          /allianz|signal iduna|ergo|axa/i
        ],
        category: 'Insurance',
        confidence: 0.95
      },
      
      // Subscriptions & Memberships
      {
        patterns: [
          /netflix|spotify|amazon prime|amznprime|disney/i,
          /paypal.*subscription|abo|mitgliedschaft/i,
          /google|apple|microsoft.*subscription/i,
          /claude\.ai|anthropic/i
        ],
        category: 'Subscriptions',
        confidence: 0.9
      },
      
      // Entertainment
      {
        patterns: [
          /kino|cinema|theater|konzert/i,
          /steam|playstation|xbox|nintendo/i,
          /ticket|event|show/i
        ],
        category: 'Entertainment',
        confidence: 0.85
      },
      
      // Shopping & Online
      {
        patterns: [
          /amazon(?!.*prime)|ebay|zalando|otto/i,
          /paypal(?!.*subscription)|klarna|riverty/i,
          /h&m|zara|c&a|media markt|saturn/i
        ],
        category: 'Shopping',
        confidence: 0.85
      },
      
      // Income
      {
        patterns: [
          /lohn|gehalt|salary|income|arbeitgeber/i,
          /rente|pension|sozial|arbeitslosengeld/i,
          /rückzahlung|refund|erstattung/i
        ],
        category: 'Income',
        confidence: 0.95
      },
      
      // Banking & Fees
      {
        patterns: [
          /gebühr|fee|zinsen|interest/i,
          /überweisung.*gebühr|transaction.*fee/i,
          /kontoführung|account.*fee/i
        ],
        category: 'Bank Fees',
        confidence: 0.9
      }
    ];
  }

  // Main labeling function
  labelTransaction(transaction) {
    const text = `${transaction.description} ${transaction.recipient}`.toLowerCase();
    
    let bestMatch = {
      category: 'Other',
      confidence: 0,
      reasons: []
    };

    // Test against all rule patterns
    for (const rule of this.rules) {
      const matchingPatterns = rule.patterns.filter(pattern => pattern.test(text));
      
      if (matchingPatterns.length > 0) {
        const confidence = rule.confidence * (matchingPatterns.length / rule.patterns.length);
        
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category: rule.category,
            confidence: confidence,
            reasons: matchingPatterns.map(p => p.source)
          };
        }
      }
    }

    // Amount-based adjustments
    bestMatch = this.adjustByAmount(transaction, bestMatch);
    
    // Direction-based adjustments  
    bestMatch = this.adjustByDirection(transaction, bestMatch);

    return {
      suggestedCategory: bestMatch.category,
      confidence: Math.round(bestMatch.confidence * 100),
      autoAssign: bestMatch.confidence > 0.8, // Auto-assign if >80% confident
      reasons: bestMatch.reasons,
      needsReview: bestMatch.confidence < 0.7 // Flag for manual review
    };
  }

  adjustByAmount(transaction, match) {
    const amount = Math.abs(transaction.amount);
    
    // Large amounts are often rent, income, or investments
    if (amount > 500) {
      if (transaction.amount > 0) {
        // Large positive amounts likely income
        match.category = 'Income';
        match.confidence = Math.max(match.confidence, 0.7);
      } else if (match.category === 'Other') {
        // Large negative amounts might be rent
        match.category = 'Housing & Utilities';
        match.confidence = 0.6;
      }
    }
    
    // Very small amounts might be fees
    if (amount < 5 && transaction.amount < 0 && match.category === 'Other') {
      match.category = 'Bank Fees';
      match.confidence = 0.5;
    }
    
    return match;
  }

  adjustByDirection(transaction, match) {
    // Positive amounts (income) adjustments
    if (transaction.amount > 0) {
      if (['Shopping', 'Food & Groceries', 'Transportation'].includes(match.category)) {
        // These categories are usually expenses, not income
        match.confidence *= 0.3; // Reduce confidence significantly
      }
    }
    
    return match;
  }

  // Batch process multiple transactions
  labelTransactions(transactions) {
    return transactions.map(transaction => {
      const labeling = this.labelTransaction(transaction);
      
      return {
        ...transaction,
        category: labeling.autoAssign ? labeling.suggestedCategory : null,
        suggestedCategory: labeling.suggestedCategory,
        confidence: labeling.confidence,
        needsReview: labeling.needsReview || !labeling.autoAssign,
        autoLabeled: labeling.autoAssign
      };
    });
  }

  // Get statistics about auto-labeling performance
  getLabelingStats(labeledTransactions) {
    const total = labeledTransactions.length;
    const autoAssigned = labeledTransactions.filter(t => t.autoLabeled).length;
    const needsReview = labeledTransactions.filter(t => t.needsReview).length;
    const categories = [...new Set(labeledTransactions.map(t => t.suggestedCategory))];

    return {
      total,
      autoAssigned,
      autoAssignedPercent: Math.round((autoAssigned / total) * 100),
      needsReview,
      needsReviewPercent: Math.round((needsReview / total) * 100),
      categoriesFound: categories.length,
      categories
    };
  }
}

// Export singleton instance
export const autoLabeler = new AutoLabeler();