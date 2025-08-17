// Universal PDF Parser mit lokalen LLMs und ML-Modellen
import { ollamaService } from '../utils/ollamaService.js';

export class UniversalBankStatementParser {
  constructor() {
    this.models = {
      // Lightweight ML für schnelle Klassifikation
      documentClassifier: null,
      entityExtractor: null,
      // LLM für komplexe Analyse
      llmService: ollamaService
    };
    
    this.supportedBanks = new Map();
    this.confidence = {
      MIN_CONFIDENCE: 0.7,
      HIGH_CONFIDENCE: 0.9
    };
  }

  async parseDocument(file) {
    try {
      // 1. PDF Text extrahieren
      const rawText = await this.extractTextFromPDF(file);
      
      // 2. Dokument klassifizieren (Bank erkennen)
      const classification = await this.classifyDocument(rawText);
      
      // 3. Strukturierte Extraktion
      const transactions = await this.extractTransactions(rawText, classification);
      
      // 4. LLM-basierte Verbesserung bei niedriger Confidence
      const improvedTransactions = await this.enhanceWithLLM(transactions, rawText);
      
      // 5. Validierung und Qualitätsprüfung
      return this.validateAndClean(improvedTransactions);
      
    } catch (error) {
      console.error('Universal parser error:', error);
      throw error;
    }
  }

  async classifyDocument(text) {
    // Schnelle regelbasierte Erkennung für bekannte Banken
    const bankPatterns = {
      'ing': /ING[-\s]?DiBa|ING Bank/i,
      'sparkasse': /Sparkasse|S-Banking/i,
      'deutsche_bank': /Deutsche Bank|DB Privat/i,
      'commerzbank': /Commerzbank|Comdirect/i,
      'dkb': /DKB|Deutsche Kreditbank/i,
      'volksbank': /Volksbank|VR-Bank/i,
      'postbank': /Postbank/i,
      'n26': /N26|Number26/i,
      'revolut': /Revolut/i
    };

    for (const [bank, pattern] of Object.entries(bankPatterns)) {
      if (pattern.test(text)) {
        return {
          bank,
          confidence: 0.9,
          method: 'pattern_match'
        };
      }
    }

    // LLM-basierte Klassifikation für unbekannte Formate
    return await this.classifyWithLLM(text);
  }

  async classifyWithLLM(text) {
    const prompt = `
Analyse diesen Bankauszug-Text und erkenne die Bank:

TEXT: "${text.substring(0, 500)}"

Antworte nur mit JSON:
{
  "bank": "bank_name",
  "confidence": 0.8,
  "reasoning": "kurze Begründung"
}

Mögliche Banken: ING, Sparkasse, Deutsche Bank, Commerzbank, DKB, Volksbank, Postbank, N26, Revolut, unknown
`;

    try {
      const response = await this.models.llmService.query(prompt, {
        temperature: 0.1,
        max_tokens: 200
      });
      
      return JSON.parse(response);
    } catch (error) {
      console.warn('LLM classification failed, using fallback');
      return {
        bank: 'unknown',
        confidence: 0.5,
        method: 'fallback'
      };
    }
  }

  async extractTransactions(text, classification) {
    // Bank-spezifische Extraktoren
    const extractors = {
      'ing': this.extractINGTransactions.bind(this),
      'sparkasse': this.extractSparkasseTransactions.bind(this),
      'deutsche_bank': this.extractDeutscheBankTransactions.bind(this),
      'unknown': this.extractGenericTransactions.bind(this)
    };

    const extractor = extractors[classification.bank] || extractors['unknown'];
    const transactions = await extractor(text);

    // Confidence-basierte Entscheidung für LLM-Enhancement
    const avgConfidence = transactions.reduce((sum, tx) => sum + (tx.confidence || 0.5), 0) / transactions.length;
    
    if (avgConfidence < this.confidence.MIN_CONFIDENCE) {
      console.log('Low confidence detected, using LLM enhancement');
      return await this.enhanceWithLLM(transactions, text);
    }

    return transactions;
  }

  async enhanceWithLLM(transactions, originalText) {
    const prompt = `
Analysiere diese Bankauszug-Daten und verbessere die Transaktionsextraktion:

ORIGINALTEXT: "${originalText.substring(0, 1000)}"

EXTRAHIERTE TRANSAKTIONEN:
${JSON.stringify(transactions, null, 2)}

Aufgaben:
1. Korrigiere falsche Extraktion
2. Ergänze fehlende Transaktionen
3. Verbessere Empfänger-Namen
4. Kategorisiere Transaktionen

Antworte mit verbessertem JSON-Array:
[
  {
    "date": "YYYY-MM-DD",
    "recipient": "Empfänger Name",
    "description": "Beschreibung",
    "amount": -123.45,
    "category": "groceries|salary|utilities|entertainment|transport|other",
    "confidence": 0.95
  }
]
`;

    try {
      const response = await this.models.llmService.query(prompt, {
        temperature: 0.2,
        max_tokens: 2000
      });
      
      const improvedTransactions = JSON.parse(response);
      
      // Merge mit original Transaktionen falls LLM weniger gefunden hat
      return this.mergeTransactions(transactions, improvedTransactions);
      
    } catch (error) {
      console.warn('LLM enhancement failed:', error);
      return transactions;
    }
  }

  async extractGenericTransactions(text) {
    // Universeller LLM-basierter Extraktor für unbekannte Formate
    const prompt = `
Extrahiere ALLE Transaktionen aus diesem Bankauszug:

TEXT: "${text}"

Finde für jede Transaktion:
- Datum (normalisiert zu YYYY-MM-DD)
- Empfänger/Absender
- Betrag (negativ für Ausgaben, positiv für Eingänge)
- Beschreibung/Verwendungszweck

Antworte nur mit JSON-Array:
[
  {
    "date": "YYYY-MM-DD",
    "recipient": "Name",
    "description": "Zweck",
    "amount": -123.45,
    "confidence": 0.85
  }
]
`;

    try {
      const response = await this.models.llmService.query(prompt, {
        temperature: 0.1,
        max_tokens: 3000
      });
      
      return JSON.parse(response);
    } catch (error) {
      console.error('Generic LLM extraction failed:', error);
      return [];
    }
  }

  // Bank-spezifische Extraktoren (optimiert)
  async extractINGTransactions(text) {
    // Kombination aus Regex + LLM für beste Ergebnisse
    const regexTransactions = this.extractINGWithRegex(text);
    
    if (regexTransactions.length > 0) {
      // Regex hat funktioniert, verwende LLM nur für Enhancement
      return await this.enhanceTransactionsWithLLM(regexTransactions, text.substring(0, 500));
    }
    
    // Fallback zu vollständiger LLM-Extraktion
    return await this.extractGenericTransactions(text);
  }

  extractINGWithRegex(text) {
    // Deine existierende ING-Regex-Logik hier
    const transactions = [];
    const transactionBlocks = text.split(/(?=\d{1,2}\.\d{1,2}\.(?:20)?\d{2}\s+(?:Ueberweisung|Lastschrift|Entgelt|Gutschrift|Dauerauftrag))/);
    
    for (const block of transactionBlocks) {
      // ... existing logic ...
      const transaction = this.parseINGBlock(block);
      if (transaction) {
        transaction.confidence = 0.8; // Regel-basiert = mittlere Confidence
        transactions.push(transaction);
      }
    }
    
    return transactions;
  }

  async enhanceTransactionsWithLLM(transactions, context) {
    // LLM verbessert nur spezifische Felder
    const prompt = `
Verbessere diese Transaktionsdaten basierend auf dem Kontext:

KONTEXT: "${context}"

TRANSAKTIONEN:
${JSON.stringify(transactions, null, 2)}

Verbessere nur:
1. Empfänger-Namen (entferne Codes, normalisiere)
2. Beschreibungen (mache verständlicher)
3. Kategorisierung

Behalte Datum und Betrag unverändert.
`;

    try {
      const response = await this.models.llmService.query(prompt, {
        temperature: 0.2,
        max_tokens: 1500
      });
      
      const enhanced = JSON.parse(response);
      return enhanced.map(tx => ({
        ...tx,
        confidence: Math.min((tx.confidence || 0.8) + 0.1, 0.95)
      }));
      
    } catch (error) {
      console.warn('Transaction enhancement failed:', error);
      return transactions;
    }
  }

  mergeTransactions(original, improved) {
    // Intelligentes Merging basierend auf Confidence
    const merged = [];
    const usedImproved = new Set();

    for (const origTx of original) {
      // Finde beste Entsprechung in improved
      let bestMatch = null;
      let bestSimilarity = 0;

      improved.forEach((impTx, index) => {
        if (usedImproved.has(index)) return;
        
        const similarity = this.calculateTransactionSimilarity(origTx, impTx);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = { transaction: impTx, index };
        }
      });

      if (bestMatch && bestSimilarity > 0.7) {
        // Verwende verbesserte Version
        merged.push({
          ...bestMatch.transaction,
          confidence: Math.max(origTx.confidence || 0.5, bestMatch.transaction.confidence || 0.5)
        });
        usedImproved.add(bestMatch.index);
      } else {
        // Behalte Original
        merged.push(origTx);
      }
    }

    // Füge neue Transaktionen aus improved hinzu
    improved.forEach((impTx, index) => {
      if (!usedImproved.has(index)) {
        merged.push(impTx);
      }
    });

    return merged;
  }

  calculateTransactionSimilarity(tx1, tx2) {
    // Vergleiche Datum, Betrag und Beschreibung
    const dateSimilarity = tx1.date === tx2.date ? 1 : 0;
    const amountSimilarity = Math.abs(tx1.amount - tx2.amount) < 0.01 ? 1 : 0;
    const descSimilarity = this.stringSimilarity(
      tx1.description?.toLowerCase() || '', 
      tx2.description?.toLowerCase() || ''
    );

    return (dateSimilarity * 0.4 + amountSimilarity * 0.4 + descSimilarity * 0.2);
  }

  stringSimilarity(str1, str2) {
    // Einfache Jaccard-Ähnlichkeit
    const set1 = new Set(str1.split(' '));
    const set2 = new Set(str2.split(' '));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  validateAndClean(transactions) {
    return transactions
      .filter(tx => this.isValidTransaction(tx))
      .map(tx => this.cleanTransaction(tx))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  isValidTransaction(tx) {
    return tx.date && 
           tx.amount !== undefined && 
           !isNaN(tx.amount) && 
           tx.recipient && 
           tx.recipient.length > 1;
  }

  cleanTransaction(tx) {
    return {
      ...tx,
      recipient: tx.recipient.trim().substring(0, 50),
      description: tx.description?.trim().substring(0, 100) || '',
      confidence: tx.confidence || 0.7,
      category: tx.category || 'other'
    };
  }

  // Training und Verbesserung
  async learnFromFeedback(originalText, userCorrectedTransactions) {
    // Sammle Feedback für zukünftige Verbesserungen
    const feedbackData = {
      timestamp: new Date().toISOString(),
      originalText: originalText.substring(0, 1000),
      correctedTransactions: userCorrectedTransactions,
      bankType: await this.classifyDocument(originalText)
    };

    // Speichere lokal für zukünftige Modell-Updates
    this.storeFeedback(feedbackData);
    
    // Optional: Retraine lokales Modell
    if (this.shouldRetrain()) {
      await this.retrainLocalModel();
    }
  }

  storeFeedback(feedbackData) {
    // Lokaler Storage für Training-Daten
    const key = `feedback_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(feedbackData));
  }

  shouldRetrain() {
    // Retraine nach N Feedback-Samples
    const feedbackKeys = Object.keys(localStorage).filter(key => key.startsWith('feedback_'));
    return feedbackKeys.length % 10 === 0; // Alle 10 Feedbacks
  }

  async retrainLocalModel() {
    // Implementierung für lokales Model-Training
    console.log('Starting local model retraining...');
    // TODO: TensorFlow.js Training Pipeline
  }

  // Text-basierte Parsing-Methode für Integration mit bestehenden PDF-Parsern
  async parseText(text, progressCallback = null) {
    try {
      if (progressCallback) progressCallback('Universal parser: classifying document...');
      
      // 1. Dokument klassifizieren (Bank erkennen)
      const classification = await this.classifyDocument(text);
      
      if (progressCallback) progressCallback('Universal parser: extracting transactions...');
      
      // 2. Strukturierte Extraktion
      const transactions = await this.extractTransactions(text, classification);
      
      if (progressCallback) progressCallback('Universal parser: enhancing with LLM...');
      
      // 3. LLM-basierte Verbesserung bei niedriger Confidence
      const improvedTransactions = await this.enhanceWithLLM(transactions, text);
      
      if (progressCallback) progressCallback('Universal parser: validating results...');
      
      // 4. Validierung und Qualitätsprüfung
      return this.validateAndClean(improvedTransactions);
      
    } catch (error) {
      console.error('Universal parser text parsing error:', error);
      throw error;
    }
  }
}

export const universalParser = new UniversalBankStatementParser();