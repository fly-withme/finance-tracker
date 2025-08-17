// Dynamic import for PDF.js to avoid SSR issues
let pdfjsLib = null;

// Import services for parsing
import { uploadLogger } from './uploadLogger.js';
import { db } from './db.js';

const initializePdfJs = async () => {
  if (typeof window !== 'undefined' && !pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
  }
  return pdfjsLib;
};

export class BankStatementParser {
  constructor() {
    // Updated noise patterns to explicitly remove reference numbers and other clutter
    this.noisePatterns = [
      /\bDE\d{2}[\s\d]{18,20}\b/gi, // IBANs
      /\b[A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?\b/gi, // BICs
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/gi, 
      /Folgenr\.\s*\d+/gi,
      /Verfalld\.\s*\d{4}-\d{2}/gi,
      /Mandat:\s*\S+/gi,
      /Referenz:\s*\S+/gi, // Crucial for removing noise that was mistaken for amounts
    ];
  }

  async parseFile(file, progressCallback = null) {
    try {
      if (progressCallback) progressCallback('Loading PDF library...');
      const pdfjs = await initializePdfJs();
      if (!pdfjs) throw new Error('PDF.js could not be loaded.');

      if (progressCallback) progressCallback('Reading PDF file...');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      if (progressCallback) progressCallback(`Extracting text from ${pdf.numPages} pages...`);
      
      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join('\n');
        fullText += pageText + '\n\n'; // Add extra newline between pages
      }
      
      uploadLogger.logPDFExtraction(pdf.numPages, fullText.length);
      
      if (fullText.trim().length < 50) {
        throw new Error('PDF appears to be empty or contains no readable text.');
      }
      
      // --- START: HYBRID "SMART" WORKFLOW ---
      if (progressCallback) progressCallback('Running fast, rule-based extraction...');
      const ruleBasedTransactions = this.extractTransactions(fullText);
      uploadLogger.log('INFO', `⚡ Specialist parser found ${ruleBasedTransactions.length} transactions.`);

      if (ruleBasedTransactions.length > 3) {
          uploadLogger.log('SUCCESS', '✅ Specialist parser succeeded. Finalizing...');
          return this.deduplicateTransactions(ruleBasedTransactions);
      }

      uploadLogger.log('WARNING', '⚠️ Specialist parser results are poor. Escalating to Universal AI parser...');
      if (progressCallback) progressCallback('Rule-based extraction failed, trying Universal AI parser...');

      try {
          const { UniversalBankStatementParser } = await import('../ml/universalParser.js');
          const universalParser = new UniversalBankStatementParser();
          const universalTransactions = await universalParser.parseText(fullText, progressCallback);
          
          if (universalTransactions && universalTransactions.length > 0) {
              uploadLogger.log('SUCCESS', `🌐 Universal AI parser found ${universalTransactions.length} transactions.`);
              return universalTransactions;
          } else {
              uploadLogger.log('ERROR', '❌ Universal AI parser also failed to find transactions.');
              return ruleBasedTransactions; 
          }
      } catch (error) {
          uploadLogger.log('ERROR', `🌐 Universal AI parser encountered an error: ${error.message}`);
          throw new Error(`The Universal AI parser failed: ${error.message}`);
      }
      // --- END: HYBRID "SMART" WORKFLOW ---

    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF file: ${error.message}.`);
    }
  }

  extractTransactions(text) {
    console.log('Starting rule-based transaction extraction...');
    const preprocessedText = text.replace(/(\r\n|\r)/g, '\n');
    const bankType = this.detectBankType(preprocessedText);
    let transactions = [];

    if (bankType === 'ING') {
        transactions = this.extractINGTransactions(preprocessedText);
    } else if (bankType === 'Vivid') {
        transactions = this.extractVividTableFormat(preprocessedText);
    }
    
    console.log(`Total extracted ${transactions.length} transactions before deduplication.`);
    return this.deduplicateTransactions(transactions);
  }
  
  detectBankType(text) {
    if (/ING-DIBa|INGDDEFFXXX/i.test(text)) return 'ING';
    if (/Vivid Money S\.A\.|SXPYDEHHXXX/i.test(text)) return 'Vivid';
    return 'Unknown';
  }

  // --- BANK-SPECIFIC STRATEGIES ---

  /**
   * FINAL, ROBUST ING PARSER
   * This logic ensures one transaction per block and prevents "ghost transactions".
   */
  extractINGTransactions(text) {
    console.log('Using FINAL robust ING extraction strategy...');
    const transactions = [];
    // This regex splits the text at any newline that is followed by a date (TT.MM.JJJJ) 
    // and at least two spaces, which is a reliable pattern for ING statements.
    const blocks = text.split(/\n(?=\d{2}\.\d{2}\.\d{4}\s{2,})/);

    for (const block of blocks) {
      const lines = block.trim().split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) continue;

      const dateLine = lines[0].trim();
      
      // Verbesserte Betragserkennung: Suche in ALLEN Zeilen nach dem Transaktionsbetrag
      let amountMatch = null;
      let amountLineIndex = -1;
      
      // Durchsuche alle Zeilen nach einem gültigen Transaktionsbetrag
      for (let i = 1; i < lines.length; i++) {
        const potentialAmountMatch = this.extractValidAmount(lines[i].trim());
        if (potentialAmountMatch) {
          amountMatch = potentialAmountMatch;
          amountLineIndex = i;
          console.log(`🎯 Transaktionsbetrag gefunden in Zeile ${i}: "${potentialAmountMatch[0]}"`);
          break; // Nehme den ersten gefundenen Transaktionsbetrag
        }
      }
      
      // Fallback: Wenn kein expliziter Transaktionsbetrag gefunden, versuche letzte Zeile
      if (!amountMatch) {
        const lastLine = lines[lines.length - 1].trim();
        amountMatch = this.extractValidAmount(lastLine);
        amountLineIndex = lines.length - 1;
        
        if (amountMatch) {
          console.log(`📋 Fallback-Betrag aus letzter Zeile: "${amountMatch[0]}"`);
        }
      }
      
      // If no valid amount found anywhere, skip this block
      if (!amountMatch) {
        console.log(`⚠️ Kein gültiger Betrag im gesamten Block gefunden, überspringe`);
        continue;
      }

      const date = dateLine.substring(0, 10);
      const amount = this.normalizeAmount(amountMatch[0]);

      // Sammle Beschreibungszeilen (alle außer Datum und Betragzeile)
      let descriptionLines = [];
      for (let i = 1; i < lines.length; i++) {
        if (i !== amountLineIndex) {
          descriptionLines.push(lines[i]);
        }
      }
      
      // Falls die Betragzeile zusätzlichen Content hat, füge ihn hinzu
      if (amountLineIndex >= 0) {
        const amountLineContent = lines[amountLineIndex].replace(amountMatch[0], '').replace(/EUR|€/g, '').trim();
        if (amountLineContent && amountLineContent.length > 3) {
          descriptionLines.push(amountLineContent);
        }
      }
      
      const fullDescription = descriptionLines.join(' ').replace(/\s+/g, ' ').trim();
      if (!fullDescription) {
        console.log(`⚠️ Keine Beschreibung gefunden, überspringe`);
        continue;
      }

      const { recipient, description } = this.extractINGRecipientAndDescription(fullDescription);

      if (this.isValidTransaction(date, recipient, amount)) {
          transactions.push({
              date: this.normalizeDate(date),
              recipient,
              description,
              amount,
              account: 'ING'
          });
      }
    }
    
    console.log(`Final ING strategy extracted ${transactions.length} transactions.`);
    return transactions;
  }

  /**
   * VIVID PARSER
   */
  extractVividTableFormat(text) {
    // This is a placeholder for your working Vivid parser logic.
    console.log('Using Vivid table format strategy...');
    const transactions = [];
    // ... (Your previously validated, working Vivid parser logic here) ...
    return transactions;
  }

  // --- HELPER FUNCTIONS ---

  isValidTransaction(date, recipient, amount) {
    return date && recipient && !isNaN(amount) && recipient.length > 1;
  }

  /**
   * IMPROVED ING HELPER FUNCTION
   * Recognizes special cases like PayPal and provides better recipient names.
   */
  extractINGRecipientAndDescription(textBlock) {
    let recipient = "Unbekannt";
    let description = textBlock;

    // Rule for PayPal: "Ihr Einkauf bei [Merchant]" is the true recipient.
    const paypalMatch = description.match(/Ihr Einkauf bei\s+([^,]+)/i);
    if (paypalMatch && paypalMatch[1]) {
      recipient = paypalMatch[1].trim();
      return { recipient, description: `PayPal: ${recipient}` };
    }

    // Rule for Kleingeld Plus
    const kleingeldMatch = description.match(/Aus Kauf .* bei\s+([^S]+)/i);
    if (kleingeldMatch && kleingeldMatch[1]) {
      recipient = "Kleingeld Plus";
      description = `Sparen von Einkauf bei ${kleingeldMatch[1].trim()}`;
      return { recipient, description };
    }
    
    // Generic rule: The recipient is usually after the transaction type.
    const typeKeywords = /^(Lastschrift|Ueberweisung|Gutschrift|Entgelt|GIROCARD)\s*/i;
    const genericBlock = description.replace(typeKeywords, '');
    recipient = genericBlock.split(/,|\/{2}/)[0].trim();

    // Final cleanup of the description string
    for (const pattern of this.noisePatterns) {
      description = description.replace(pattern, '');
    }
    description = description.replace(/\s+/g, ' ').trim();

    if (!recipient || recipient.length < 2) {
      recipient = "Unbekannt";
    }

    return { recipient, description };
  }
  
  normalizeDate(dateString) {
    if (!dateString) return new Date().toISOString().slice(0, 10);
    const parts = dateString.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (parts) {
      const year = parts[3];
      const month = parts[2].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().slice(0, 10);
  }

  normalizeAmount(amountString) {
    if (!amountString) return 0;
    
    // Entferne zuerst Währungssymbole und Leerzeichen
    let cleaned = amountString
      .replace(/EUR/gi, '')
      .replace(/€/g, '')
      .trim();
    
    // Prüfe ob es sich um eine ungültige Referenznummer oder ID handelt
    if (this.isInvalidAmountFormat(cleaned)) {
      console.warn(`Ungültiges Betragsformat erkannt und gefiltert: "${amountString}"`);
      return 0;
    }
    
    // Normale Betragsbereinigung
    cleaned = cleaned
      .replace(/\./g, '')    // Entferne Tausendertrennzeichen
      .replace(/,/, '.');    // Ersetze Dezimalkomma durch Punkt
    
    const amount = parseFloat(cleaned);
    
    // Zusätzliche Validierung: Extreme Beträge abfangen
    if (isNaN(amount) || Math.abs(amount) > 1000000) { // Max 1 Million Euro
      console.warn(`Extremer Betrag erkannt und gefiltert: "${amountString}" -> ${amount}`);
      return 0;
    }
    
    return amount;
  }

  /**
   * Prüft ob ein String eine ungültige Referenznummer oder ID ist,
   * die fälschlicherweise als Betrag erkannt wurde
   */
  isInvalidAmountFormat(cleanedString) {
    // Entferne alle Nicht-Ziffern für weitere Prüfungen
    const digitsOnly = cleanedString.replace(/[^\d]/g, '');
    
    // Regel 1: Mehr als 12 Ziffern sind definitiv keine normalen Beträge
    if (digitsOnly.length > 12) {
      return true;
    }
    
    // Regel 2: Strings mit Buchstaben sind keine Beträge
    if (/[a-zA-Z]/.test(cleanedString)) {
      return true;
    }
    
    // Regel 3: Referenznummer-Muster erkennen
    const referencePatterns = [
      /^\d{10,}$/,           // Nur sehr lange Zahlenfolgen
      /\d{4}[A-Z0-9]{4,}/,   // Gemischte Alphanumerische Referenzen
      /[A-Z]{2,}\d{4,}/,     // Buchstaben gefolgt von Zahlen
      /\d{13,}/,             // Mehr als 13 aufeinanderfolgende Ziffern
    ];
    
    return referencePatterns.some(pattern => pattern.test(cleanedString));
  }

  /**
   * Extrahiert nur valide Geldbeträge aus einer Zeile
   * Filtert Referenznummern und andere numerische IDs heraus
   */
  extractValidAmount(line) {
    // Früh-Filterung nur für extreme Referenznummern, nicht für normale Bankzeilen
    // Prüfe auf einzelne zusammenhängende extreme Zahlenfolgen (Referenznummern)
    const extremeNumberMatch = line.match(/\d{15,}/);
    if (extremeNumberMatch) {
      console.warn(`Zeile enthält extreme zusammenhängende Zahlenfolge (${extremeNumberMatch[0].length} Ziffern), überspringe: "${line.substring(0, 100)}..."`);
      return null;
    }
    
    // PRIORITÄT 1: Suche nach Transaktionsbeträgen mit expliziter Währung und Vorzeichen
    const transactionAmountPatterns = [
      // Negative Beträge mit EUR (Ausgaben) - höchste Priorität
      /(-\d{1,6}(?:\.\d{3})*,\d{2})\s*EUR/i,
      // Positive Beträge mit + und EUR (Eingänge)
      /(\+\d{1,6}(?:\.\d{3})*,\d{2})\s*EUR/i,
      // Beträge mit expliziter EUR-Bezeichnung direkt dahinter
      /(-?\d{1,6}(?:\.\d{3})*,\d{2})\s*EUR(?!\s*EUR)/i
    ];
    
    // Suche zuerst nach expliziten Transaktionsbeträgen
    for (const pattern of transactionAmountPatterns) {
      const match = line.match(pattern);
      if (match) {
        const potentialAmount = match[1];
        console.log(`🎯 Transaktionsbetrag gefunden: "${potentialAmount}" aus "${line}"`);
        
        if (this.isValidTransactionAmount(potentialAmount)) {
          return [potentialAmount];
        }
      }
    }
    
    // PRIORITÄT 2: Falls kein expliziter Transaktionsbetrag gefunden, suche nach anderen Mustern
    // ABER nur wenn die Zeile nicht mehrere Beträge enthält (Kontostand-Problem)
    const allAmounts = line.match(/\d{1,6}(?:\.\d{3})*,\d{2}/g) || [];
    if (allAmounts.length > 1) {
      console.warn(`Zeile enthält mehrere Beträge (${allAmounts.length}), überspringe wegen Kontostand-Ambiguität: "${line}"`);
      return null;
    }
    
    // Fallback-Patterns nur bei eindeutigen Beträgen
    const fallbackPatterns = [
      // Beträge am Ende der Zeile ohne Währung
      /(-?\d{1,6}(?:\.\d{3})*,\d{2})$/,
      // Einfache Beträge mit €-Symbol
      /(-?\d{1,6}(?:\.\d{3})*,\d{2})\s*€/i
    ];
    
    for (const pattern of fallbackPatterns) {
      try {
        const match = line.match(pattern);
        if (match) {
          const potentialAmount = match[1];
          
          if (this.isValidTransactionAmount(potentialAmount)) {
            console.log(`📋 Fallback-Betrag gefunden: "${potentialAmount}" aus "${line}"`);
            return [potentialAmount];
          }
        }
      } catch (error) {
        // Browser-Kompatibilität
        console.warn('Pattern matching error:', error);
      }
    }
    
    return null;
  }

  /**
   * Validiert ob ein extrahierter Betrag ein gültiger Transaktionsbetrag ist
   */
  isValidTransactionAmount(potentialAmount) {
    // Vorvalidierung: Prüfe Länge der Ziffern vor dem Komma
    const beforeComma = potentialAmount.split(',')[0].replace(/[^\d]/g, '');
    if (beforeComma.length > 6) {
      console.warn(`Betrag zu groß (${beforeComma.length} Vorkomma-Ziffern): "${potentialAmount}"`);
      return false;
    }
    
    // Zusätzliche Validierung: Ist es wirklich ein Geldbetrag?
    if (this.isInvalidAmountFormat(potentialAmount)) {
      return false;
    }
    
    // Prüfe ob der Betrag in einem realistischen Bereich liegt
    const normalizedAmount = this.normalizeAmount(potentialAmount);
    if (normalizedAmount === 0 || Math.abs(normalizedAmount) > 1000000) {
      return false;
    }
    
    return true;
  }
  
  deduplicateTransactions(transactions) {
    const seen = new Set();
    return transactions.filter(tx => {
      // Use a more robust key to prevent legitimate duplicate amounts on the same day
      const key = `${tx.date}-${tx.amount.toFixed(2)}-${tx.recipient}-${tx.description.slice(0, 10)}`;
      if (seen.has(key)) {
        return false;
      } else {
        seen.add(key);
        return true;
      }
    });
  }
}

export const bankStatementParser = new BankStatementParser();