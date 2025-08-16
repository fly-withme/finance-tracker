// Dynamic import for PDF.js to avoid SSR issues
let pdfjsLib = null;

// Import Ollama service for AI-enhanced parsing
import { ollamaService } from './ollamaService.js';
import { autoLabeler } from './autoLabeler.js';

const initializePdfJs = async () => {
  if (typeof window !== 'undefined' && !pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
  }
  return pdfjsLib;
};

export class BankStatementParser {
  constructor() {
    // Regex patterns to identify and remove noise from descriptions
    this.noisePatterns = [
      /\bDE\d{2}[\s\d]{18,20}\b/g, // IBANs
      /\b[A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?\b/g, // BICs
      /\b\d{2}[-.\/]\d{2}[-.\/]\d{2,4}\b/g, // Dates
      /[-+]?\d{1,3}(?:[,\.]\d{3})*[,\.]\d{2}\s*EUR/g, // Amounts in EUR
      /\b\d{2}--\d{4}-\d{7}\b/g, // Internal reference numbers
      /\b[A-Z]{2}-\d+/g, // Other reference codes
      /SEPA-Lastschriftmandat|Überweisung zwischen eigenen Konten|Kartentransaktion/g,
    ];
  }

  async parseFile(file) {
    try {
      const pdfjs = await initializePdfJs();
      if (!pdfjs) throw new Error('PDF.js could not be loaded.');

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ');
      }
      
      if (fullText.trim().length < 50) {
        throw new Error('PDF appears to be empty or contains no readable text.');
      }
      
      return this.extractTransactions(fullText);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF file: ${error.message}.`);
    }
  }

  extractTransactions(text) {
    console.log('Starting transaction extraction from text length:', text.length);
    
    // Multiple strategies for different bank statement formats
    const strategies = [
      this.extractGermanFormat.bind(this),
      this.extractTableFormat.bind(this),
      this.extractKeyValueFormat.bind(this)
    ];
    
    let allTransactions = [];
    
    for (const strategy of strategies) {
      try {
        const strategyTransactions = strategy(text);
        console.log(`Strategy extracted ${strategyTransactions.length} transactions`);
        allTransactions = allTransactions.concat(strategyTransactions);
      } catch (error) {
        console.warn('Strategy failed:', error.message);
      }
    }
    
    console.log(`Total extracted ${allTransactions.length} transactions before deduplication`);
    const deduplicated = this.deduplicateTransactions(allTransactions);
    console.log(`Final ${deduplicated.length} transactions after deduplication`);
    
    return deduplicated;
  }

  extractGermanFormat(text) {
    // Improved pattern that handles both positive and negative amounts
    const transactionBlockRegex = /(\d{1,2}\.\d{1,2}\.(?:20)?\d{2})\s+([\s\S]*?)\s+([-+]?[\d,]+(?:[,\.]\d{2})?\s*EUR?)/g;
    const transactions = [];
    let match;

    while ((match = transactionBlockRegex.exec(text)) !== null) {
      const date = match[1];
      const contentBlock = match[2].trim();
      const amount = match[3];

      // Skip if content block is too short or looks like noise
      if (contentBlock.length < 3 || this.isNoise(contentBlock)) {
        continue;
      }

      const { recipient, description } = this.extractRecipientAndDescription(contentBlock);
      
      if (recipient && this.isValidTransaction(date, recipient, amount)) {
        transactions.push({
          date: this.normalizeDate(date),
          recipient: recipient,
          description: description,
          amount: this.normalizeAmount(amount),
          account: 'Imported'
        });
      }
    }
    
    return transactions;
  }

  extractTableFormat(text) {
    // Handle table-like formats with columns
    const lines = text.split(/\n|\r\n/);
    const transactions = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for date at the beginning of line
      const dateMatch = line.match(/^(\d{1,2}\.\d{1,2}\.(?:20)?\d{2})/);
      if (!dateMatch) continue;
      
      const date = dateMatch[1];
      const restOfLine = line.substring(dateMatch[0].length).trim();
      
      // Look for amount at the end
      const amountMatch = restOfLine.match(/([-+]?[\d,]+(?:[,\.]\d{2})?\s*EUR?)\s*$/);
      if (!amountMatch) continue;
      
      const amount = amountMatch[1];
      const description = restOfLine.substring(0, restOfLine.length - amountMatch[0].length).trim();
      
      if (description.length > 2 && this.isValidTransaction(date, description, amount)) {
        const { recipient, description: cleanDesc } = this.extractRecipientAndDescription(description);
        
        transactions.push({
          date: this.normalizeDate(date),
          recipient: recipient,
          description: cleanDesc,
          amount: this.normalizeAmount(amount),
          account: 'Imported'
        });
      }
    }
    
    return transactions;
  }

  extractKeyValueFormat(text) {
    // Handle formats where each transaction is on multiple lines
    const transactions = [];
    const sections = text.split(/(?=\d{1,2}\.\d{1,2}\.(?:20)?\d{2})/);
    
    for (const section of sections) {
      if (section.trim().length < 10) continue;
      
      const dateMatch = section.match(/(\d{1,2}\.\d{1,2}\.(?:20)?\d{2})/);
      if (!dateMatch) continue;
      
      const amountMatch = section.match(/([-+]?[\d,]+(?:[,\.]\d{2})?\s*EUR?)/);
      if (!amountMatch) continue;
      
      const date = dateMatch[1];
      const amount = amountMatch[1];
      
      // Extract description between date and amount
      let description = section
        .replace(dateMatch[0], '')
        .replace(amountMatch[0], '')
        .trim();
      
      // Clean up noise
      for (const pattern of this.noisePatterns) {
        description = description.replace(pattern, '');
      }
      description = description.replace(/\s+/g, ' ').trim();
      
      if (description.length > 2 && this.isValidTransaction(date, description, amount)) {
        const { recipient, description: cleanDesc } = this.extractRecipientAndDescription(description);
        
        transactions.push({
          date: this.normalizeDate(date),
          recipient: recipient,
          description: cleanDesc,
          amount: this.normalizeAmount(amount),
          account: 'Imported'
        });
      }
    }
    
    return transactions;
  }

  isNoise(text) {
    // Check if text looks like noise or metadata
    const noiseIndicators = [
      /^(IBAN|BIC|Ref|Datum|Betrag|Empfänger|Verwendungszweck)$/i,
      /^[A-Z]{2}\d{2}[\s\d]+$/,  // IBAN-like
      /^\d{2}-\d{2}-\d{4}$/,     // Reference numbers
      /^EUR\s*$/,               // Just currency
      /^[-+]?\d+[,\.]\d{2}$/    // Just amount
    ];
    
    return noiseIndicators.some(pattern => pattern.test(text.trim()));
  }

  isValidTransaction(date, description, amount) {
    // Basic validation to filter out obvious non-transactions
    if (!date || !description || !amount) return false;
    if (description.length < 2) return false;
    
    // Check if description contains meaningful content
    const meaningfulWords = /\b(Gehalt|Miete|Einkauf|Transfer|Lastschrift|Überweisung|Karte|Netflix|REWE|Supermarkt|Restaurant|Tanken|Apotheke|Insurance|Salary|Rent|Grocery|Payment)\b/i;
    
    // Either contains meaningful words OR is long enough to be descriptive
    return meaningfulWords.test(description) || description.length > 8;
  }

  extractRecipientAndDescription(textBlock) {
    // Clean the input first
    let cleanedBlock = textBlock
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove obvious noise patterns first
    for (const pattern of this.noisePatterns) {
      cleanedBlock = cleanedBlock.replace(pattern, ' ');
    }
    cleanedBlock = cleanedBlock.replace(/\s+/g, ' ').trim();
    
    let recipient = null;
    let description = cleanedBlock;
    
    // Strategy 1: Look for well-known companies/services
    const knownEntities = /\b(Netflix|Amazon|PayPal|REWE|Edeka|Lidl|ALDI|Spotify|Apple|Google|Microsoft|Deutsche Bank|Sparkasse|Vodafone|Telekom|O2)\b/i;
    const knownMatch = cleanedBlock.match(knownEntities);
    if (knownMatch) {
      recipient = knownMatch[0];
    }
    
    // Strategy 2: Look for company suffixes
    if (!recipient) {
      const companyRegex = /\b([A-Za-zÄÖÜäöü\s&.\-']+?\s*(?:GmbH|AG|KG|e\.?V\.?|Inc\.?|LLC|Ltd\.?|OHG|UG))\b/i;
      const companyMatch = cleanedBlock.match(companyRegex);
      if (companyMatch) {
        recipient = companyMatch[1].trim();
      }
    }
    
    // Strategy 3: Look for transaction types and extract merchant
    if (!recipient) {
      const patterns = [
        /(?:SEPA-Lastschrift|Lastschrift|Kartenzahlung|Karte)\s+([A-Za-zÄÖÜäöü\s\-&.0-9]+?)(?:\s|$)/i,
        /(?:Überweisung|Transfer)\s+(?:an\s+)?([A-Za-zÄÖÜäöü\s\-&.]+?)(?:\s|$)/i,
        /(?:Zahlung|Payment)\s+(?:an\s+)?([A-Za-zÄÖÜäöü\s\-&.]+?)(?:\s|$)/i,
        /(?:Von|From)\s+([A-Za-zÄÖÜäöü\s\-&.]+?)(?:\s|$)/i
      ];
      
      for (const pattern of patterns) {
        const match = cleanedBlock.match(pattern);
        if (match && match[1]) {
          recipient = match[1].trim();
          break;
        }
      }
    }
    
    // Strategy 4: Take first meaningful word(s) as fallback
    if (!recipient) {
      const words = cleanedBlock.split(/\s+/).filter(word => 
        word.length > 2 && 
        !/^\d+$/.test(word) && 
        !this.isNoise(word)
      );
      
      if (words.length > 0) {
        // Take first 1-3 words as recipient
        recipient = words.slice(0, Math.min(3, words.length)).join(' ');
      }
    }
    
    // Clean recipient
    if (recipient) {
      recipient = recipient
        .replace(/[,.:;]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50); // Limit length
    }
    
    // Generate meaningful description
    description = this.generateDescription(cleanedBlock, recipient);
    
    return { 
      recipient: recipient || "Unbekannt", 
      description: description || "Transaktion" 
    };
  }

  generateDescription(textBlock, recipient) {
    // Remove recipient from description to avoid redundancy
    let desc = textBlock;
    if (recipient) {
      desc = desc.replace(new RegExp(recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
    
    // Look for meaningful descriptive patterns
    const patterns = [
      /\b(Miete|Rent|Mortgage)\b/i,
      /\b(Gehalt|Salary|Lohn|Bonus)\b/i,
      /\b(Einkauf|Shopping|Supermarkt|Grocery)\b/i,
      /\b(Tankstelle|Tanken|Gas|Fuel)\b/i,
      /\b(Restaurant|Gastronomie|Café|Coffee)\b/i,
      /\b(Apotheke|Pharmacy|Medikament)\b/i,
      /\b(Versicherung|Insurance)\b/i,
      /\b(Strom|Electricity|Gas|Utilities)\b/i,
      /\b(Internet|Telefon|Mobilfunk|Phone)\b/i,
      /\b(Abonnement|Subscription|Mitgliedschaft|Membership)\b/i,
      /\b(Rechnung|Invoice|Bill)\b/i,
      /\b(Rückerstattung|Refund|Erstattung)\b/i
    ];
    
    for (const pattern of patterns) {
      const match = desc.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Clean up and return first meaningful part
    desc = desc
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    
    // If description is too short or empty, generate based on recipient
    if (!desc || desc.length < 3) {
      if (recipient && recipient !== "Unbekannt") {
        return `Zahlung an ${recipient}`;
      }
      return "Transaktion";
    }
    
    return desc;
  }

  normalizeDate(dateString) {
    if (!dateString) return new Date().toISOString().slice(0, 10);
    const parts = dateString.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (parts) {
      // parts[1] = Tag, parts[2] = Monat, parts[3] = Jahr
      return new Date(parts[3], parts[2] - 1, parts[1]).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }

  normalizeAmount(amountString) {
    if (!amountString) return 0;
    
    // Handle different formats and signs
    let cleaned = amountString
      .replace(/EUR?/gi, '')  // Remove EUR/EURO
      .replace(/\s+/g, '')    // Remove spaces
      .trim();
    
    // Check for explicit positive/negative signs
    const isNegative = cleaned.startsWith('-') || cleaned.includes('SOLL') || cleaned.includes('BELASTUNG');
    const isPositive = cleaned.startsWith('+') || cleaned.includes('HABEN') || cleaned.includes('GUTSCHRIFT');
    
    // Remove signs and keywords
    cleaned = cleaned
      .replace(/^[-+]/, '')
      .replace(/SOLL|HABEN|BELASTUNG|GUTSCHRIFT/gi, '')
      .trim();
    
    // Handle German number format (comma as decimal separator)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Format like "1.234,56" - thousand separator is dot, decimal is comma
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      // Simple comma decimal like "123,45"
      cleaned = cleaned.replace(',', '.');
    }
    
    const amount = parseFloat(cleaned) || 0;
    
    // Apply sign logic
    if (isPositive) {
      return Math.abs(amount);
    } else if (isNegative) {
      return -Math.abs(amount);
    }
    
    // Default behavior: if no explicit sign, check if it looks like income
    const originalText = amountString.toLowerCase();
    const incomeKeywords = ['gehalt', 'salary', 'lohn', 'bonus', 'dividend', 'zinsen', 'interest', 'gutschrift', 'haben'];
    const isLikelyIncome = incomeKeywords.some(keyword => originalText.includes(keyword));
    
    return isLikelyIncome ? Math.abs(amount) : -Math.abs(amount);
  }
  
  deduplicateTransactions(transactions) {
    console.log('Deduplicating transactions...');
    
    // Sort by date and amount for better comparison
    transactions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.amount - b.amount;
    });
    
    const seen = new Map();
    const duplicates = [];
    
    const uniqueTransactions = transactions.filter((tx, index) => {
      // Create multiple keys for different levels of similarity
      const exactKey = `${tx.date}-${tx.amount}-${tx.recipient.toLowerCase().trim()}`;
      const fuzzyKey = `${tx.date}-${tx.amount}-${tx.description.toLowerCase().slice(0, 20)}`;
      const amountDateKey = `${tx.date}-${tx.amount}`;
      
      // Check for exact duplicates first
      if (seen.has(exactKey)) {
        duplicates.push({ index, reason: 'exact', key: exactKey, transaction: tx });
        return false;
      }
      
      // Check for fuzzy duplicates (same date, amount, similar description)
      if (seen.has(fuzzyKey)) {
        duplicates.push({ index, reason: 'fuzzy', key: fuzzyKey, transaction: tx });
        return false;
      }
      
      // Check for potential duplicates with same date and amount
      const similarTransactions = Array.from(seen.entries())
        .filter(([key, _]) => key.startsWith(amountDateKey))
        .map(([_, txData]) => txData);
      
      if (similarTransactions.length > 0) {
        // Check if this transaction is too similar to existing ones
        const isSimilar = similarTransactions.some(existingTx => {
          const recipientSimilarity = this.calculateSimilarity(
            tx.recipient.toLowerCase(), 
            existingTx.recipient.toLowerCase()
          );
          const descriptionSimilarity = this.calculateSimilarity(
            tx.description.toLowerCase(), 
            existingTx.description.toLowerCase()
          );
          
          return recipientSimilarity > 0.8 || descriptionSimilarity > 0.8;
        });
        
        if (isSimilar) {
          duplicates.push({ index, reason: 'similar', transaction: tx });
          return false;
        }
      }
      
      // Store all keys for this transaction
      seen.set(exactKey, tx);
      seen.set(fuzzyKey, tx);
      return true;
    });
    
    if (duplicates.length > 0) {
      console.log(`Removed ${duplicates.length} duplicates:`, duplicates);
    }
    
    console.log(`Deduplicated: ${transactions.length} -> ${uniqueTransactions.length}`);
    return uniqueTransactions;
  }

  calculateSimilarity(str1, str2) {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export const bankStatementParser = new BankStatementParser();
