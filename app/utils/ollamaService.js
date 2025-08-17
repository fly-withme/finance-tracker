import { performanceMonitor } from './performanceMonitor.js';
import { uploadLogger } from './uploadLogger.js';
import { db } from './db.js';

export class OllamaService {
  constructor() {
    this.baseUrl = 'http://localhost:11434';
    this.model = 'llama3.2'; // Fallback auf qwen2.5 oder phi3 wenn verfügbar
    this.isAvailable = null;
  }

  async checkAvailability() {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Available Ollama models:', data.models?.map(m => m.name));
        
        // Check for preferred models
        const availableModels = data.models?.map(m => m.name) || [];
        if (availableModels.includes('qwen2.5:latest')) {
          this.model = 'qwen2.5:latest';
        } else if (availableModels.includes('phi3:latest')) {
          this.model = 'phi3:latest';
        } else if (availableModels.includes('llama3.2:latest')) {
          this.model = 'llama3.2:latest';
        } else if (availableModels.includes('mistral:7b-instruct-q4_K_M')) {
          this.model = 'mistral:7b-instruct-q4_K_M';
        } else if (availableModels.includes('mistral:latest')) {
          this.model = 'mistral:latest';
        } else if (availableModels.length > 0) {
          this.model = availableModels[0];
        }
        
        this.isAvailable = true;
        console.log('Using Ollama model:', this.model);
      } else {
        this.isAvailable = false;
      }
    } catch (error) {
      console.log('Ollama not available:', error.message);
      this.isAvailable = false;
    }

    return this.isAvailable;
  }

  async parseBankStatement(pdfText, bankType = 'vivid', progressCallback = null, userCategories = null) {
    const operationId = performanceMonitor.startOperation('ollama_parse_statement');
    
    try {
      // Check system load before proceeding
      if (performanceMonitor.isSystemOverloaded()) {
        if (progressCallback) progressCallback('System busy, waiting for resources...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
      
      const isAvailable = await this.checkAvailability();
      if (!isAvailable) {
        throw new Error('Ollama service not available');
      }

      if (progressCallback) progressCallback('Loading user categories...');
      
      // Lade Benutzerkategorien falls nicht übergeben
      if (!userCategories) {
        try {
          userCategories = await db.categories.toArray();
          uploadLogger.logCategoriesUsed(userCategories);
        } catch (error) {
          uploadLogger.log('WARNING', 'Konnte Kategorien nicht laden, verwende Standard-Kategorien', error);
          userCategories = [];
        }
      }
      
      if (progressCallback) progressCallback('Preparing text for AI analysis...');
      const prompt = this.createBankStatementPrompt(pdfText, bankType, userCategories);
      
      uploadLogger.logLLMRequest(bankType, prompt.length, this.model);
      if (progressCallback) progressCallback('Sending request to AI model...');
      
      // Add timeout and abort controller for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_ctx: 4096, // Erhöht für bessere Verarbeitung längerer Texte
            num_predict: 256, // Reduced prediction length
            num_thread: Math.max(1, Math.min(2, Math.floor((navigator.hardwareConcurrency || 4) / 2))), // Limit to max 2 threads
            num_gpu: 0, // Disable GPU to reduce system load
            low_vram: true, // Enable low VRAM mode
          }
        }),
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      if (progressCallback) progressCallback('Processing AI response...');
      const data = await response.json();
      
      if (progressCallback) progressCallback('Parsing transactions...');
      const startParseTime = performance.now();
      const result = this.parseAIResponse(data.response);
      const parseTime = performance.now() - startParseTime;
      
      uploadLogger.logLLMResponse(result, parseTime);
      performanceMonitor.endOperation(operationId);
      return result;
    } catch (error) {
      performanceMonitor.endOperation(operationId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out - the AI model took too long to respond');
      }
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }

  createBankStatementPrompt(pdfText, bankType, userCategories = []) {
    // Intelligent text chunking for better performance
    const maxLength = 4000; // Erhöht für mehr Transaktionen
    let processedText = pdfText;
    
    // Extract only transaction-relevant parts
    const transactionPatterns = [
      /\d{1,2}\.\d{1,2}\.\d{2,4}.*?[-+]?[\d,]+[,\.]\d{2}\s*EUR?/g,
      /\d{1,2}[-.\s]\d{1,2}[-.\s]\d{2,4}.*?\w+.*?[-+]?[\d,]+/g
    ];
    
    let relevantChunks = [];
    for (const pattern of transactionPatterns) {
      const matches = pdfText.match(pattern);
      if (matches) {
        relevantChunks = relevantChunks.concat(matches); // Alle Transaktionen verarbeiten
      }
    }
    
    if (relevantChunks.length > 0) {
      processedText = relevantChunks.join('\n');
    }
    
    const truncatedText = processedText.length > maxLength 
      ? processedText.substring(0, maxLength) + '...' 
      : processedText;
    
    // Erstelle Liste der verfügbaren Kategorien
    const categoryList = userCategories.length > 0 
      ? userCategories.map(cat => cat.name).join(', ')
      : 'Food & Groceries, Transportation, Housing & Utilities, Shopping, Entertainment, Health & Fitness, Income, Bank Fees, Other';
    
    uploadLogger.log('DEBUG', `Verwende ${userCategories.length} Benutzerkategorien: ${categoryList}`);
    
    return `Du bist ein Experte für deutsche Bankauszüge. Extrahiere ALLE Transaktionen aus diesem ${bankType} Kontoauszug.

WICHTIGE REGELN:
1. Antworte NUR mit gültigem JSON-Array
2. Keine Erklärungen oder zusätzlicher Text
3. Erkenne deutsche Datumsformate (DD.MM.YYYY)
4. Negative Beträge für Ausgaben, positive für Eingänge
5. Bereinige Empfänger-Namen (entferne IBANs, BICs, Codes)
6. Erkenne auch teilweise Transaktionen in Blöcken
7. Ordne JEDER Transaktion eine passende Kategorie zu

VERFÜGBARE KATEGORIEN (verwende NUR diese):
${categoryList}

FORMAT:
[{"date":"YYYY-MM-DD","description":"Saubere Beschreibung","recipient":"Empfänger Name","amount":-12.34,"category":"Food & Groceries"}]

BEISPIELE deutscher Transaktionen:
- "15.08.2024 Überweisung An REWE SAGT DANKE 1234 -45.67 EUR" 
  → {"date":"2024-08-15","recipient":"REWE","description":"Einkauf","amount":-45.67,"category":"Food & Groceries"}
- "16.08.2024 SEPA-Lastschrift Netflix Europe -9.99 EUR"
  → {"date":"2024-08-16","recipient":"Netflix","description":"Streaming-Abonnement","amount":-9.99,"category":"Entertainment"}
- "17.08.2024 Gehalt Musterfirma GmbH +2500.00 EUR"
  → {"date":"2024-08-17","recipient":"Musterfirma GmbH","description":"Gehalt","amount":2500.00,"category":"Income"}

KONTOAUSZUG-TEXT:
${truncatedText}

JSON-ARRAY:`;
  }

  parseAIResponse(aiResponse) {
    try {
      uploadLogger.log('DEBUG', 'Rohe LLM-Antwort:', aiResponse.substring(0, 500) + '...');
      
      // Clean the response - remove any text before/after JSON
      let jsonText = aiResponse.trim();
      
      // Extract JSON array if it's wrapped in other text
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        uploadLogger.log('DEBUG', 'JSON extrahiert aus Antwort');
      } else {
        uploadLogger.log('WARNING', 'Kein JSON-Array in LLM-Antwort gefunden');
      }

      const transactions = JSON.parse(jsonText);
      
      if (!Array.isArray(transactions)) {
        throw new Error('Response is not an array');
      }
      
      uploadLogger.log('INFO', `${transactions.length} Transaktionen aus JSON geparst`);

      // Validate and normalize each transaction
      const validTransactions = transactions.filter(t => this.isValidTransaction(t));
      const normalizedTransactions = validTransactions.map((t, index) => this.normalizeTransaction(t, index));
      
      uploadLogger.log('INFO', `${validTransactions.length} gültige Transaktionen nach Validierung`);
      
      return normalizedTransactions;

    } catch (error) {
      uploadLogger.log('ERROR', 'Fehler beim Parsen der LLM-Antwort', {
        error: error.message,
        rawResponse: aiResponse.substring(0, 200)
      });
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  isValidTransaction(transaction) {
    return transaction &&
           typeof transaction.date === 'string' &&
           typeof transaction.amount === 'number' &&
           transaction.description &&
           transaction.recipient;
  }

  normalizeTransaction(transaction, index) {
    const normalizedTransaction = {
      id: Date.now() + Math.random() + index,
      date: this.normalizeDate(transaction.date),
      description: this.cleanText(transaction.description),
      recipient: this.cleanText(transaction.recipient),
      amount: Number(transaction.amount),
      account: transaction.account || 'Vivid Money (AI)',
      category: transaction.category || null, // BEHALTE die LLM-Kategorie!
      type: transaction.type || 'Unknown',
      rawText: transaction.rawText || ''
    };
    
    uploadLogger.log('DEBUG', `Normalized: ${normalizedTransaction.recipient} | ${normalizedTransaction.amount}€ | Kategorie: ${normalizedTransaction.category || 'Keine'}`);
    
    return normalizedTransaction;
  }

  normalizeDate(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return new Date().toISOString().slice(0, 10);
      }
      return date.toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/[A-Z]{2}\d{2}[A-Z0-9\s]+/g, '') // Remove IBANs
      .replace(/\d+\s+[A-Z]{3}XXX/g, '') // Remove BIC codes
      .replace(/Karte \*\d+/g, '') // Remove card references
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Method to suggest installing Ollama if not available
  getInstallationInstructions() {
    return {
      message: 'Ollama ist nicht verfügbar. Für bessere PDF-Auslesung installiere Ollama:',
      steps: [
        '1. Gehe zu https://ollama.ai',
        '2. Lade Ollama für dein System herunter',
        '3. Installiere und starte Ollama',
        '4. Führe aus: ollama pull llama3.2',
        '5. Alternativ: ollama pull qwen2.5 (besser für strukturierte Daten)',
        '6. Starte die App neu'
      ]
    };
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();