/**
 * German Transaction Analyzer
 * Specialized AI expert for analyzing financial transactions from German bank statements.
 * Main task: Extract the actual recipient (merchant) and distinguish from payment processors.
 */

export class GermanTransactionAnalyzer {
  constructor() {
    // Known payment processors/intermediaries
    this.paymentProcessors = new Map([
      ['paypal', /PayPal(?:\s+Europe\s+S\.a\.r\.l\.\s+et\s+Cie\s+S\.C\.A)?/i],
      ['klarna', /Klarna/i],
      ['stripe', /Stripe/i],
      ['adyen', /Adyen/i],
      ['mollie', /Mollie\s+Payments/i],
      ['stichting_pay', /Stichting\s+Pay\.nl/i],
      ['payone', /PAYONE/i],
      ['worldpay', /Worldpay/i],
      ['square', /Square/i],
      ['sumup', /SumUp/i]
    ]);

    // Patterns for merchant extraction
    this.merchantPatterns = [
      // PayPal specific patterns
      {
        processor: 'paypal',
        patterns: [
          // Pattern 1: "1043644529546/. Uber, Ihr Einkauf bei Uber"
          /\/\.\s(.*?),\sIhr Einkauf bei/i,
          // Pattern 2: "PP.1234.PP Merchant Name"
          /PP\.\d+\.PP\s+(.*?)(?:\s*,|\s*$)/i,
          // Pattern 3: "Referenz: 98765, Verwendungszweck: Lieferando"
          /Referenz:.*?Verwendungszweck:\s*(.*?)$/i,
          // Pattern 4: Simple merchant name after reference numbers
          /\d{10,}\/?\.\s*([A-Za-z][^,\d]{2,}?)(?:\s*,|\s*$)/i,
          // Pattern 5: Direct merchant name in text
          /PayPal.*?([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*,|\s*Ihr\s+Einkauf|\s*$)/i,
          // Pattern 6: After long reference numbers
          /\b\d{13,}\b[\/\.\s]*([A-Za-z][^,\d\n]{2,}?)(?:\s*,|\s*$)/i
        ]
      },
      // Stichting Pay.nl patterns
      {
        processor: 'stichting_pay',
        patterns: [
          /Verwendungszweck:\s*(?:Ihre\s+Bestellung\s+bei\s+)?(.*?)$/i,
          /Kennzeichen:.*?Verwendungszweck:\s*(.*?)$/i
        ]
      },
      // Generic patterns for other processors
      {
        processor: 'generic',
        patterns: [
          /bei\s+(.*?)(?:\s*,|\s*$)/i,
          /Verwendungszweck:\s*(.*?)$/i,
          /Referenz:.*?(\w+(?:\s+\w+)*?)(?:\s*,|\s*$)/i
        ]
      }
    ];
  }

  /**
   * Analyze a transaction string and extract the actual merchant
   * @param {string} transactionText - Raw transaction text
   * @returns {Object} - {recipient, payment_processor, confidence}
   */
  analyzeTransaction(transactionText) {
    console.log('🚀 German Transaction Analyzer called with:', transactionText?.substring(0, 100));
    
    if (!transactionText || typeof transactionText !== 'string') {
      console.log('❌ Invalid input, returning default');
      return {
        recipient: 'Unbekannt',
        payment_processor: null,
        confidence: 0.1
      };
    }

    const cleanText = transactionText.trim();
    
    // Step 1: Detect payment processor
    const detectedProcessor = this.detectPaymentProcessor(cleanText);
    
    // Step 2: Extract merchant name
    const merchantInfo = this.extractMerchant(cleanText, detectedProcessor);
    
    // Step 3: Apply business rules and confidence scoring
    return this.applyBusinessRules(merchantInfo, detectedProcessor, cleanText);
  }

  /**
   * Detect if a payment processor is involved
   */
  detectPaymentProcessor(text) {
    for (const [processorKey, pattern] of this.paymentProcessors) {
      if (pattern.test(text)) {
        return {
          key: processorKey,
          name: this.getProcessorDisplayName(processorKey),
          pattern: pattern
        };
      }
    }
    return null;
  }

  /**
   * Extract merchant name based on detected processor
   */
  extractMerchant(text, processor) {
    if (!processor) {
      // Direct transaction - use first part as recipient
      return this.extractDirectRecipient(text);
    }

    // Find processor-specific patterns
    const processorPatterns = this.merchantPatterns.find(p => 
      p.processor === processor.key || p.processor === 'generic'
    );

    if (processorPatterns) {
      for (const pattern of processorPatterns.patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const merchantName = this.cleanMerchantName(match[1]);
          if (merchantName && merchantName.length > 2) {
            return {
              name: merchantName,
              confidence: 0.9,
              method: 'pattern_match'
            };
          }
        }
      }
    }

    // Fallback: try generic extraction
    return this.extractGenericMerchant(text, processor);
  }

  /**
   * Extract recipient from direct transactions (no payment processor)
   */
  extractDirectRecipient(text) {
    // Remove transaction type keywords
    const typeKeywords = /^(Lastschrift|Ueberweisung|Gutschrift|Entgelt|GIROCARD|Dauerauftrag)\s*/i;
    const cleanedText = text.replace(typeKeywords, '');
    
    // Take first part before comma or double slash
    const recipient = cleanedText.split(/,|\/\//)[0].trim();
    
    return {
      name: recipient,
      confidence: 0.95,
      method: 'direct_extraction'
    };
  }

  /**
   * Generic merchant extraction for unknown processors
   */
  extractGenericMerchant(text, processor) {
    // Special handling for PayPal
    if (processor.key === 'paypal') {
      return this.extractPayPalMerchantAdvanced(text);
    }

    // Remove processor name from text
    let cleanedText = text.replace(processor.pattern, '');
    
    // Remove common noise patterns
    const noisePatterns = [
      /Lastschrift|Gutschrift|Ueberweisung/gi,
      /Mandat:|Referenz:|Kennzeichen:/gi,
      /\b\d{10,}\b/g, // Long reference numbers
      /\bDE\d{2}[\s\d]{18,20}\b/gi, // IBANs
      /\d{4}-\d{2}-\d{2}/g // Dates
    ];

    noisePatterns.forEach(pattern => {
      cleanedText = cleanedText.replace(pattern, '');
    });

    // Clean up and extract meaningful text
    cleanedText = cleanedText.replace(/[,\/.]/g, ' ').replace(/\s+/g, ' ').trim();

    if (cleanedText.length > 2 && /[a-zA-Z]/.test(cleanedText)) {
      return {
        name: cleanedText.substring(0, 50),
        confidence: 0.7,
        method: 'generic_cleanup'
      };
    }

    return {
      name: processor.name,
      confidence: 0.6,
      method: 'fallback_processor'
    };
  }

  /**
   * Advanced PayPal merchant extraction
   */
  extractPayPalMerchantAdvanced(text) {
    console.log('🔍 PayPal extraction input:', text.substring(0, 200));

    // ING-specific PayPal transaction patterns based on real format
    const strategies = [
      // Strategy 1: "PP.1234567890.PP / Uber, Ihr Einkauf bei Uber"
      {
        pattern: /PP\.\d+\.PP\s*\/\s*([^,]+?)(?:\s*,|\s*Ihr\s*Einkauf|\s*$)/i,
        confidence: 0.95,
        name: 'pp_reference_slash'
      },
      // Strategy 2: "1234567890/. Uber, Ihr Einkauf bei Uber"
      {
        pattern: /\b\d{10,}\s*\/\.\s*([^,\-]+?)(?:\s*,|\s*Ihr\s*Einkauf|\s*-|\s*$)/i,
        confidence: 0.9,
        name: 'number_slash_dot'
      },
      // Strategy 3: "Verwendungszweck: Lieferando"
      {
        pattern: /Verwendungszweck:\s*([^,\-\d\n]+?)(?:\s*-|\s*$)/i,
        confidence: 0.85,
        name: 'verwendungszweck'
      },
      // Strategy 4: Known merchant names anywhere in text
      {
        pattern: /\b(Uber|Amazon|eBay|Spotify|Netflix|Zalando|Otto|Media Markt|Saturn|Lieferando|Deliveroo|McDonald|KFC|Burger King|Starbucks|Apple|Google|Microsoft|Adobe|Airbnb|Booking)\b/i,
        confidence: 0.95,
        name: 'known_merchant'
      },
      // Strategy 5: After reference number, before amount
      {
        pattern: /Referenz:\s*\S+\s+([A-Za-z][A-Za-z\s]{2,}?)(?:\s*-|\s*\d|\s*$)/i,
        confidence: 0.8,
        name: 'after_referenz'
      }
    ];

    for (const strategy of strategies) {
      const match = text.match(strategy.pattern);
      if (match && match[1]) {
        let merchantName = match[1].trim();
        
        // Clean up the merchant name
        merchantName = merchantName
          .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        console.log(`🎯 Strategy "${strategy.name}" found: "${merchantName}"`);
        
        // Validate merchant name
        if (merchantName && 
            merchantName.length >= 2 && 
            merchantName.length <= 50 &&
            /^[A-Za-z]/.test(merchantName) &&
            !this.isPayPalNoise(merchantName)) {
          
          return {
            name: this.capitalizeProperNouns(merchantName),
            confidence: strategy.confidence,
            method: strategy.name
          };
        }
      }
    }

    // Advanced fallback - extract meaningful words from cleaned text
    let cleanedText = text
      .replace(/PayPal\s*\(?Europe\)?\s*S\.à?\s*r\.l\.\s*et\s*Cie[,\s]*S\.C\.A\.?/gi, '') // Remove full PayPal company name
      .replace(/Lastschrift|Gutschrift|Ueberweisung/gi, '')
      .replace(/Mandat:|Referenz:|Kennzeichen:/gi, '')
      .replace(/\bPP\.\d+\.PP\b/gi, '') // Remove PP reference
      .replace(/\b\d{10,}\b/g, '') // Remove long numbers
      .replace(/\bEUR\b|\b€\b/gi, '') // Remove currency
      .replace(/[-,\/.]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ')
      .trim();

    console.log('🧹 Cleaned text for fallback:', cleanedText);

    // Find meaningful words
    const meaningfulWords = cleanedText.split(' ').filter(word => 
      word.length >= 3 && 
      /^[A-Za-z]/.test(word) && 
      !this.isPayPalNoise(word)
    );

    if (meaningfulWords.length > 0) {
      const merchantName = meaningfulWords.slice(0, 2).join(' ');
      console.log('📦 Fallback merchant found:', merchantName);
      return {
        name: this.capitalizeProperNouns(merchantName),
        confidence: 0.7,
        method: 'paypal_fallback'
      };
    }

    console.log('❌ No merchant found, using PayPal as fallback');
    return {
      name: 'PayPal',
      confidence: 0.6,
      method: 'paypal_unknown'
    };
  }

  /**
   * Check if a word is PayPal-related noise
   */
  isPayPalNoise(word) {
    const noiseWords = [
      'PayPal', 'Europe', 'S.a.r.l', 'et', 'Cie', 'S.C.A',
      'Lastschrift', 'Gutschrift', 'EUR', 'Mandat', 'Referenz', 
      'Kennzeichen', 'und', 'der', 'die', 'das', 'bei', 'von', 
      'Ihr', 'Einkauf', 'für', 'mit'
    ];
    
    return noiseWords.some(noise => 
      word.toLowerCase() === noise.toLowerCase() ||
      word.toLowerCase().includes(noise.toLowerCase())
    );
  }

  /**
   * Clean and normalize merchant name
   */
  cleanMerchantName(merchantName) {
    if (!merchantName) return null;
    
    // Remove common prefixes/suffixes
    let cleaned = merchantName
      .replace(/^(bei|an|von)\s+/i, '')
      .replace(/\s+(GmbH|AG|Ltd|Inc|LLC)$/i, ' $1')
      .replace(/[,\/.]+$/, '')
      .trim();

    // Remove reference numbers and codes
    cleaned = cleaned.replace(/\b[A-Z0-9]{8,}\b/g, '').trim();
    
    // Capitalize properly
    cleaned = this.capitalizeProperNouns(cleaned);
    
    return cleaned;
  }

  /**
   * Apply business rules and determine final confidence
   */
  applyBusinessRules(merchantInfo, processor, originalText) {
    let finalRecipient = merchantInfo.name || 'Unbekannt';
    let finalConfidence = merchantInfo.confidence || 0.5;
    let paymentProcessor = processor ? processor.name : null;

    // Rule 1: Always prioritize merchant over processor
    if (processor && merchantInfo.name && 
        !this.isSameAsProcessor(merchantInfo.name, processor.name)) {
      finalRecipient = merchantInfo.name;
      finalConfidence = Math.min(merchantInfo.confidence + 0.1, 0.98);
    }

    // Rule 2: Special handling for well-known merchants
    const knownMerchants = ['Amazon', 'eBay', 'Uber', 'Lieferando', 'Bol.com', 'Zalando'];
    if (knownMerchants.some(merchant => 
        originalText.toLowerCase().includes(merchant.toLowerCase()))) {
      const merchant = knownMerchants.find(m => 
        originalText.toLowerCase().includes(m.toLowerCase()));
      finalRecipient = merchant;
      finalConfidence = 0.95;
    }

    // Rule 3: Minimum confidence for processor fallback
    if (processor && finalConfidence < 0.7 && 
        this.isSameAsProcessor(finalRecipient, processor.name)) {
      finalConfidence = 0.6;
    }

    // Rule 4: Boost confidence for direct transactions
    if (!processor) {
      finalConfidence = Math.min(finalConfidence + 0.05, 0.98);
    }

    return {
      recipient: finalRecipient,
      payment_processor: paymentProcessor,
      confidence: Math.round(finalConfidence * 100) / 100
    };
  }

  /**
   * Check if merchant name is same as processor (to avoid redundancy)
   */
  isSameAsProcessor(merchantName, processorName) {
    if (!merchantName || !processorName) return false;
    
    const merchant = merchantName.toLowerCase().trim();
    const processor = processorName.toLowerCase().trim();
    
    return merchant === processor || 
           merchant.includes(processor) || 
           processor.includes(merchant);
  }

  /**
   * Get display name for processor
   */
  getProcessorDisplayName(processorKey) {
    const displayNames = {
      'paypal': 'PayPal',
      'klarna': 'Klarna',
      'stripe': 'Stripe',
      'adyen': 'Adyen',
      'mollie': 'Mollie Payments',
      'stichting_pay': 'Stichting Pay.nl',
      'payone': 'PAYONE',
      'worldpay': 'Worldpay',
      'square': 'Square',
      'sumup': 'SumUp'
    };
    
    return displayNames[processorKey] || processorKey;
  }

  /**
   * Capitalize proper nouns in merchant names
   */
  capitalizeProperNouns(text) {
    if (!text) return text;
    
    // Split by spaces and capitalize each word appropriately
    return text.split(' ').map(word => {
      // Keep all caps for known abbreviations
      if (/^[A-Z]{2,}$/.test(word)) return word;
      
      // Capitalize first letter, keep rest as is for mixed case
      if (word.length > 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    }).join(' ');
  }

  /**
   * Batch analyze multiple transactions
   */
  analyzeTransactions(transactions) {
    return transactions.map(transaction => {
      const analysis = this.analyzeTransaction(transaction.description || transaction.recipient);
      
      return {
        ...transaction,
        recipient: analysis.recipient,
        payment_processor: analysis.payment_processor,
        confidence: analysis.confidence
      };
    });
  }

  /**
   * Get analysis statistics
   */
  getAnalysisStats(results) {
    if (!Array.isArray(results) || results.length === 0) {
      return { total: 0, avgConfidence: 0, processorsDetected: 0 };
    }

    const totalTransactions = results.length;
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / totalTransactions;
    const processorsDetected = results.filter(r => r.payment_processor).length;
    
    return {
      total: totalTransactions,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      processorsDetected,
      processorPercentage: Math.round((processorsDetected / totalTransactions) * 100)
    };
  }
}

export const germanTransactionAnalyzer = new GermanTransactionAnalyzer();