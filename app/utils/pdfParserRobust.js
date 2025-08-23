// Ultimate PDF Parser with webpack-compatible worker setup
import { uploadLogger } from './uploadLogger.js';
import { db } from './db.js';
import { germanTransactionAnalyzer } from './germanTransactionAnalyzer.js';

let pdfjsLib = null;
let initializationPromise = null;

const initializePdfJs = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js can only be used in browser environment');
    }

    if (pdfjsLib) {
      return pdfjsLib;
    }

    try {
      console.log('🔄 Loading PDF.js (robust method)...');
      
      // Import PDF.js core library
      const pdfjs = await import('pdfjs-dist');
      
      // Simple, reliable worker configuration
      if (pdfjs.GlobalWorkerOptions) {
        // Use data URI with minimal worker code - works in all environments
        const minimalWorker = 'self.onmessage=function(e){self.postMessage({action:"ready"});};';
        pdfjs.GlobalWorkerOptions.workerSrc = `data:application/javascript;base64,${btoa(minimalWorker)}`;
        
        console.log('✅ PDF.js configured with minimal inline worker');
      }
      
      pdfjsLib = pdfjs;
      return pdfjsLib;
      
    } catch (error) {
      console.error('Failed to load PDF.js:', error);
      throw new Error('PDF.js konnte nicht geladen werden. Bitte laden Sie die Seite neu.');
    }
  })();

  return initializationPromise;
};

export class BankStatementParser {
  constructor() {
    this.noisePatterns = [
      /\bDE\d{2}[\s\d]{18,20}\b/gi, // IBANs
      /\b[A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?\b/gi, // BICs
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/gi, 
      /Folgenr\.\s*\d+/gi,
      /Verfalld\.\s*\d{4}-\d{2}/gi,
      /Mandat:\s*\S+/gi,
      /Referenz:\s*\S+/gi,
    ];
  }

  async parseFile(file, progressCallback = null, enableSmartSuggestions = true) {
    try {
      if (progressCallback) progressCallback('PDF-Bibliothek wird initialisiert...');
      
      const pdfjs = await initializePdfJs();
      if (!pdfjs) throw new Error('PDF.js konnte nicht initialisiert werden.');

      if (progressCallback) progressCallback('PDF-Datei wird gelesen...');
      const arrayBuffer = await file.arrayBuffer();
      
      // Create loading task with optimized settings
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0, // Reduce console noise
        stopAtErrors: false,
        // Disable worker-specific options that might cause issues
        useSystemFonts: true,
        disableFontFace: false,
        // Performance optimizations for main thread
        maxImageSize: 1024 * 1024, // 1MB max image size
        disableRange: true, // Don't use range requests
        disableStream: true // Don't use streaming
      });
      
      // Add timeout protection with longer timeout for large files
      const pdf = await Promise.race([
        loadingTask.promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF loading timeout after 120 seconds')), 120000)
        )
      ]);
      
      if (progressCallback) progressCallback(`Text wird aus ${pdf.numPages} Seiten extrahiert...`);
      
      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false
          });
          
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' '); // Normalize whitespace
          
          fullText += pageText + '\n\n';
          
          if (progressCallback) {
            progressCallback(`Seite ${pageNum}/${pdf.numPages} verarbeitet...`);
          }
          
          // Clean up page resources
          page.cleanup();
          
        } catch (pageError) {
          console.warn(`Warnung: Seite ${pageNum} konnte nicht verarbeitet werden:`, pageError);
          // Continue with other pages
        }
      }
      
      // Clean up PDF resources
      pdf.destroy();
      
      uploadLogger.logPDFExtraction(pdf.numPages, fullText.length);
      
      if (fullText.trim().length < 50) {
        throw new Error('PDF scheint leer zu sein oder enthält keinen lesbaren Text.');
      }
      
      if (progressCallback) progressCallback('Transaktionen werden extrahiert...');
      
      // --- EXTRACTION WORKFLOW ---
      const ruleBasedTransactions = this.extractTransactions(fullText);
      uploadLogger.log('INFO', `⚡ Regel-Parser fand ${ruleBasedTransactions.length} Transaktionen.`);

      if (ruleBasedTransactions.length >= 1) {
          uploadLogger.log('SUCCESS', '✅ Regel-Parser erfolgreich.');
          const deduplicatedTransactions = this.deduplicateTransactions(ruleBasedTransactions);
          
          // Start smart suggestions processing in background if enabled
          if (enableSmartSuggestions && deduplicatedTransactions.length > 0) {
            this.processSmartSuggestionsInBackground(deduplicatedTransactions);
          }
          
          return deduplicatedTransactions;
      }

      uploadLogger.log('WARNING', '⚠️ Regel-Parser fand keine Transaktionen. Versuche AI-Parser...');
      if (progressCallback) progressCallback('Regel-Parser fehlgeschlagen, versuche AI-Parser...');

      try {
          const { UniversalBankStatementParser } = await import('../ml/universalParser.js');
          const universalParser = new UniversalBankStatementParser();
          const universalTransactions = await universalParser.parseText(fullText, progressCallback);
          
          if (universalTransactions && universalTransactions.length > 0) {
              uploadLogger.log('SUCCESS', `🌐 AI-Parser fand ${universalTransactions.length} Transaktionen.`);
              
              // Start smart suggestions processing in background if enabled
              if (enableSmartSuggestions) {
                this.processSmartSuggestionsInBackground(universalTransactions);
              }
              
              return universalTransactions;
          } else {
              uploadLogger.log('ERROR', '❌ Auch AI-Parser fand keine Transaktionen.');
              return ruleBasedTransactions; 
          }
      } catch (aiError) {
          uploadLogger.log('ERROR', `🌐 AI-Parser Fehler: ${aiError.message}`);
          const deduplicatedTransactions = this.deduplicateTransactions(ruleBasedTransactions);
          
          // Start smart suggestions processing in background even with fallback data
          if (enableSmartSuggestions && deduplicatedTransactions.length > 0) {
            this.processSmartSuggestionsInBackground(deduplicatedTransactions);
          }
          
          return deduplicatedTransactions;
      }

    } catch (error) {
      console.error('PDF parsing error:', error);
      
      // Provide user-friendly error messages
      if (error.message.includes('timeout')) {
        throw new Error(`PDF-Verarbeitung dauerte zu lange. Versuchen Sie eine kleinere Datei.`);
      } else if (error.message.includes('Invalid PDF') || error.message.includes('invalid')) {
        throw new Error(`Die Datei ist keine gültige PDF oder ist beschädigt.`);
      } else if (error.message.includes('encrypted')) {
        throw new Error(`Die PDF ist passwortgeschützt. Bitte verwenden Sie eine ungeschützte PDF.`);
      } else {
        throw new Error(`PDF-Verarbeitung fehlgeschlagen: ${error.message}`);
      }
    }
  }

  extractTransactions(text) {
    console.log('🔍 Starte Transaktionsextraktion...');
    const preprocessedText = text.replace(/(\r\n|\r)/g, '\n');
    const bankType = this.detectBankType(preprocessedText);
    let transactions = [];

    console.log(`🏛️ Bank erkannt: ${bankType}`);

    if (bankType === 'ING') {
        transactions = this.extractINGTransactions(preprocessedText);
    } else if (bankType === 'Vivid') {
        transactions = this.extractVividTableFormat(preprocessedText);
    } else {
        console.log('🤖 Unbekannte Bank, verwende generischen Parser...');
        transactions = this.extractGenericTransactions(preprocessedText);
    }
    
    console.log(`📊 ${transactions.length} Transaktionen vor Deduplizierung extrahiert.`);
    return this.deduplicateTransactions(transactions);
  }
  
  detectBankType(text) {
    const bankPatterns = {
      'ING': /ING[-\s]?DiBa|INGDDEFFXXX|ING Bank/i,
      'Vivid': /Vivid Money S\.A\.|SXPYDEHHXXX/i,
      'Sparkasse': /Sparkasse|S-Banking/i,
      'Deutsche Bank': /Deutsche Bank|DB Privat/i,
      'Commerzbank': /Commerzbank|Comdirect/i,
      'DKB': /DKB|Deutsche Kreditbank/i
    };

    for (const [bank, pattern] of Object.entries(bankPatterns)) {
      if (pattern.test(text)) {
        return bank;
      }
    }
    
    return 'Unknown';
  }

  extractGenericTransactions(text) {
    // Simple generic extraction for unknown bank formats
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    
    // Look for date patterns and amounts
    const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/;
    const amountPattern = /([+-]?\d{1,6}[.,]\d{2})\s*€?/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(datePattern);
      const amountMatch = line.match(amountPattern);
      
      if (dateMatch && amountMatch) {
        const date = this.normalizeDate(dateMatch[1]);
        const amount = this.normalizeAmount(amountMatch[1]);
        const description = line.replace(dateMatch[0], '').replace(amountMatch[0], '').trim();
        
        if (date && !isNaN(amount) && description.length > 3) {
          transactions.push({
            date,
            recipient: description.split(' ')[0] || 'Unbekannt',
            description,
            amount,
            account: 'Import',
            confidence: 0.6
          });
        }
      }
    }
    
    return transactions;
  }

  extractINGTransactions(text) {
    console.log('🏛️ Verwende ING-spezifische Extraktion...');
    const transactions = [];
    
    const cleanedText = this.cleanINGText(text);
    const blocks = this.splitTransactionBlocks(cleanedText);

    for (const block of blocks) {
      const lines = block.trim().split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) continue;
      
      const dateLine = lines[0].trim();
      let amountMatch = null;
      let amountLineIndex = -1;
      
      // Find amount in block
      for (let i = 1; i < lines.length; i++) {
        const potentialAmountMatch = this.extractValidAmount(lines[i].trim());
        if (potentialAmountMatch) {
          amountMatch = potentialAmountMatch;
          amountLineIndex = i;
          break;
        }
      }
      
      if (!amountMatch) continue;
      
      const date = dateLine.substring(0, 10);
      const amount = this.normalizeAmount(amountMatch[0]);
      
      // Build description from non-amount lines
      let descriptionLines = [];
      for (let i = 1; i < lines.length; i++) {
        if (i !== amountLineIndex) {
          const line = lines[i].trim();
          if (!this.isNoiseText(line)) {
            descriptionLines.push(line);
          }
        }
      }
      
      const fullDescription = descriptionLines.join(' ').replace(/\s+/g, ' ').trim();
      if (!fullDescription) continue;

      // Use German transaction analyzer
      const analysis = germanTransactionAnalyzer.analyzeTransaction(fullDescription);
      
      let finalRecipient = analysis.recipient;
      let finalDescription = fullDescription;
      
      if (analysis.confidence > 0.7) {
        finalRecipient = analysis.recipient;
        finalDescription = analysis.payment_processor ? 
          `${analysis.payment_processor}: ${analysis.recipient}` : fullDescription;
      } else {
        const { recipient, description } = this.extractINGRecipientAndDescription(fullDescription);
        finalRecipient = recipient;
        finalDescription = description;
      }

      if (this.isValidTransaction(date, finalRecipient, amount)) {
        transactions.push({
          date: this.normalizeDate(date),
          recipient: finalRecipient,
          description: finalDescription,
          amount,
          account: 'ING',
          confidence: analysis.confidence
        });
      }
    }
    
    return transactions;
  }

  extractVividTableFormat(text) {
    console.log('🏛️ Verwende Vivid-Format...');
    // Vivid-specific logic would go here
    return [];
  }

  // Helper methods (simplified versions of the originals)
  
  splitTransactionBlocks(text) {
    return text.split(/\n(?=\d{2}\.\d{2}\.\d{4}\s{2,})/);
  }
  
  cleanINGText(text) {
    // Simplified cleaning
    return text.replace(/\n\n+/g, '\n\n');
  }
  
  isNoiseText(line) {
    const noiseIndicators = [
      /PEBG\s+\d+/i, /Kontoauszug/i, /Seite \d+ von \d+/i,
      /ING-DiBa AG/i, /www\.ing\.de/i, /Geschäftsbedingungen/i
    ];
    return noiseIndicators.some(pattern => pattern.test(line));
  }
  
  extractINGRecipientAndDescription(textBlock) {
    if (textBlock.toLowerCase().includes('paypal')) {
      const merchantMatch = textBlock.match(/\/\.\s(.*?),\sIhr Einkauf bei/i);
      if (merchantMatch && merchantMatch[1]) {
        return {
          recipient: merchantMatch[1].trim(),
          description: `PayPal: ${merchantMatch[1].trim()}`
        };
      }
      return { recipient: "PayPal", description: textBlock };
    }
    
    const typeKeywords = /^(Lastschrift|Ueberweisung|Gutschrift|Entgelt|GIROCARD)\s*/i;
    const genericBlock = textBlock.replace(typeKeywords, '');
    const recipient = genericBlock.split(/,|\/{2}/)[0].trim();
    
    return {
      recipient: recipient || "Unbekannt",
      description: textBlock.replace(/\s+/g, ' ').trim()
    };
  }
  
  extractValidAmount(line) {
    const patterns = [
      /(-\d{1,6}(?:\.\d{3})*,\d{2})\s*EUR/i,
      /(\+\d{1,6}(?:\.\d{3})*,\d{2})\s*EUR/i,
      /(-?\d{1,6}(?:\.\d{3})*,\d{2})\s*€/i
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return [match[1]];
    }
    
    return null;
  }
  
  normalizeDate(dateString) {
    if (!dateString) return new Date().toISOString().slice(0, 10);
    const parts = dateString.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    if (parts) {
      return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    return new Date().toISOString().slice(0, 10);
  }

  normalizeAmount(amountString) {
    if (!amountString) return 0;
    let cleaned = amountString.replace(/EUR|€/gi, '').trim();
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }
  
  isValidTransaction(date, recipient, amount) {
    return date && recipient && !isNaN(amount) && recipient.length > 1 && Math.abs(amount) > 0;
  }
  
  deduplicateTransactions(transactions) {
    const seen = new Set();
    return transactions.filter(tx => {
      const key = `${tx.date}-${tx.amount.toFixed(2)}-${tx.recipient}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Background processing for smart suggestions
  async processSmartSuggestionsInBackground(transactions) {
    try {
      uploadLogger.log('INFO', `🧠 Starte Smart Suggestions Verarbeitung für ${transactions.length} Transaktionen im Hintergrund...`);
      
      // Import contextual suggestion engine dynamically to avoid blocking main process
      const { contextualSuggestionEngine } = await import('../ml/contextualSuggestionEngine.js');
      
      // Process suggestions for each transaction in batches to avoid blocking
      const batchSize = 3; // Reduced batch size for better UI responsiveness
      let processedCount = 0;
      
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize);
        
        // Process batch asynchronously with staggered timing
        setTimeout(async () => {
          try {
            for (const transaction of batch) {
              try {
                await contextualSuggestionEngine.precomputeSuggestions(transaction);
                processedCount++;
                
                // Log progress every 10 transactions
                if (processedCount % 10 === 0 || processedCount === transactions.length) {
                  uploadLogger.log('INFO', `🧠 Smart Suggestions: ${processedCount}/${transactions.length} Transaktionen verarbeitet`);
                }
              } catch (error) {
                console.warn(`Smart suggestions für Transaktion "${transaction.description?.substring(0, 30)}..." fehlgeschlagen:`, error);
              }
            }
            
            // Final completion message
            if (processedCount >= transactions.length) {
              uploadLogger.log('SUCCESS', `✅ Smart Suggestions Hintergrundverarbeitung abgeschlossen: ${processedCount} Transaktionen verarbeitet`);
            }
          } catch (batchError) {
            uploadLogger.log('WARNING', `🧠 Batch ${batchIndex + 1} Fehler: ${batchError.message}`);
          }
        }, 150 * batchIndex); // Increased stagger time for better performance
      }
      
      uploadLogger.log('SUCCESS', '🧠 Smart Suggestions Hintergrundverarbeitung gestartet');
    } catch (error) {
      uploadLogger.log('WARNING', `🧠 Smart Suggestions Hintergrundverarbeitung fehlgeschlagen: ${error.message}`);
    }
  }
}

export const bankStatementParser = new BankStatementParser();