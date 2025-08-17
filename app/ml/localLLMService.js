// Erweiterte lokale LLM-Integration für Finanz-Analyse
export class LocalLLMService {
  constructor() {
    this.models = {
      // Verschiedene Modell-Größen für unterschiedliche Tasks
      fast: 'llama3.2:1b',      // Schnell für Klassifikation
      balanced: 'llama3.2:3b',  // Ausgewogen für Extraktion
      accurate: 'qwen2.5:7b',   // Genau für komplexe Analyse
      financial: 'deepseek-coder:6.7b' // Speziell für strukturierte Daten
    };
    
    this.currentModel = this.models.balanced;
    this.isAvailable = false;
    this.init();
  }

  async init() {
    try {
      // Prüfe Ollama-Verfügbarkeit
      const response = await fetch('http://localhost:11434/api/version');
      this.isAvailable = response.ok;
      
      if (this.isAvailable) {
        await this.ensureModelsDownloaded();
      }
    } catch (error) {
      console.warn('Ollama not available, falling back to rule-based parsing');
      this.isAvailable = false;
    }
  }

  async ensureModelsDownloaded() {
    // Prüfe und lade benötigte Modelle
    const requiredModels = [this.models.fast, this.models.balanced];
    
    for (const model of requiredModels) {
      try {
        await this.pullModelIfNeeded(model);
      } catch (error) {
        console.warn(`Could not ensure model ${model}:`, error);
      }
    }
  }

  async pullModelIfNeeded(modelName) {
    try {
      // Prüfe ob Modell existiert
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      const exists = data.models?.some(m => m.name === modelName);

      if (!exists) {
        console.log(`Downloading model ${modelName}...`);
        await this.pullModel(modelName);
      }
    } catch (error) {
      console.warn(`Failed to check/pull model ${modelName}:`, error);
    }
  }

  async pullModel(modelName) {
    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model ${modelName}`);
    }
  }

  // Spezielle Methoden für Finanz-Tasks
  async classifyBankDocument(text) {
    if (!this.isAvailable) return null;

    const prompt = `<|system|>Du bist ein Experte für deutsche Bankauszüge. Analysiere den Text und identifiziere die Bank.<|end|>
<|user|>Analysiere diesen Bankauszug-Text und erkenne die Bank:

TEXT: "${text.substring(0, 500)}"

Antworte nur mit JSON in diesem Format:
{
  "bank": "bank_identifier",
  "confidence": 0.95,
  "layout_type": "table|block|list",
  "reasoning": "Begründung"
}

Mögliche bank_identifier: ing, sparkasse, deutsche_bank, commerzbank, dkb, volksbank, postbank, n26, revolut, comdirect, unknown<|end|>
<|assistant|>`;

    return await this.query(prompt, {
      model: this.models.fast,
      temperature: 0.1,
      max_tokens: 200
    });
  }

  async extractTransactionEntities(transactionText) {
    if (!this.isAvailable) return null;

    const prompt = `<|system|>Du bist ein NER-Experte für deutsche Banktransaktionen. Extrahiere strukturierte Daten.<|end|>
<|user|>Extrahiere aus diesem Transaktionstext alle relevanten Entitäten:

TEXT: "${transactionText}"

Finde:
- Datum (normalisiert zu YYYY-MM-DD)
- Betrag (als Zahl, negativ für Ausgaben)
- Empfänger/Absender
- Verwendungszweck
- Transaktionstyp

Antworte nur mit JSON:
{
  "date": "YYYY-MM-DD",
  "amount": -123.45,
  "recipient": "Empfänger Name",
  "description": "Verwendungszweck",
  "type": "transfer|debit|credit|card",
  "confidence": 0.9
}<|end|>
<|assistant|>`;

    return await this.query(prompt, {
      model: this.models.balanced,
      temperature: 0.1,
      max_tokens: 300
    });
  }

  async categorizeTransaction(transaction) {
    if (!this.isAvailable) return 'other';

    const prompt = `<|system|>Du bist ein Experte für Ausgaben-Kategorisierung.<|end|>
<|user|>Kategorisiere diese Transaktion:

Empfänger: ${transaction.recipient}
Beschreibung: ${transaction.description}
Betrag: ${transaction.amount}€

Wähle die beste Kategorie:
- groceries (Lebensmittel, Supermärkte)
- utilities (Strom, Gas, Wasser, Internet)
- transport (Tankstelle, ÖPNV, Taxi)
- entertainment (Restaurant, Kino, Streaming)
- healthcare (Apotheke, Arzt, Versicherung)
- salary (Gehalt, Bonus)
- rent (Miete, Nebenkosten)
- shopping (Kleidung, Online-Shopping)
- financial (Bank, Gebühren, Zinsen)
- other

Antworte nur mit der Kategorie:<|end|>
<|assistant|>`;

    try {
      const response = await this.query(prompt, {
        model: this.models.fast,
        temperature: 0.0,
        max_tokens: 20
      });
      
      const category = response.trim().toLowerCase();
      const validCategories = ['groceries', 'utilities', 'transport', 'entertainment', 'healthcare', 'salary', 'rent', 'shopping', 'financial', 'other'];
      
      return validCategories.includes(category) ? category : 'other';
    } catch (error) {
      return 'other';
    }
  }

  async improveRecipientName(rawRecipient, context) {
    if (!this.isAvailable) return rawRecipient;

    const prompt = `<|system|>Du bist ein Experte für die Normalisierung von Empfänger-Namen in Banktransaktionen.<|end|>
<|user|>Verbessere diesen Empfänger-Namen:

Roher Name: "${rawRecipient}"
Kontext: "${context.substring(0, 200)}"

Aufgaben:
1. Entferne technische Codes und IBANs
2. Korrigiere offensichtliche Tippfehler
3. Verwende bekannte Unternehmensnamen
4. Behalte wichtige Informationen

Beispiele:
"REWE SAGT DANKE 12345" → "REWE"
"PAYPAL INST XFER NETFLIX" → "Netflix (PayPal)"
"AMAZON EU SARL 123XYZ" → "Amazon"

Antworte nur mit dem verbesserten Namen (max 30 Zeichen):<|end|>
<|assistant|>`;

    try {
      const response = await this.query(prompt, {
        model: this.models.balanced,
        temperature: 0.2,
        max_tokens: 50
      });
      
      return response.trim().substring(0, 30) || rawRecipient;
    } catch (error) {
      return rawRecipient;
    }
  }

  async detectDuplicates(transactions) {
    if (!this.isAvailable || transactions.length < 2) return [];

    const prompt = `<|system|>Du bist ein Experte für Duplikats-Erkennung in Finanztransaktionen.<|end|>
<|user|>Finde Duplikate in diesen Transaktionen:

${JSON.stringify(transactions.map((tx, i) => ({
  id: i,
  date: tx.date,
  recipient: tx.recipient,
  amount: tx.amount,
  description: tx.description?.substring(0, 50)
})), null, 2)}

Kriterien für Duplikate:
- Gleicher Tag und Betrag
- Sehr ähnlicher Empfänger
- Ähnliche Beschreibung

Antworte mit JSON-Array der Duplikat-IDs:
[1, 5, 7]

Falls keine Duplikate: []<|end|>
<|assistant|>`;

    try {
      const response = await this.query(prompt, {
        model: this.models.balanced,
        temperature: 0.1,
        max_tokens: 200
      });
      
      return JSON.parse(response) || [];
    } catch (error) {
      console.warn('Duplicate detection failed:', error);
      return [];
    }
  }

  async generateSpendingInsights(transactions) {
    if (!this.isAvailable) return null;

    const prompt = `<|system|>Du bist ein Experte für Finanz-Analyse und persönliche Ausgaben-Beratung.<|end|>
<|user|>Analysiere diese Transaktionen und generiere Insights:

${JSON.stringify(transactions.slice(0, 20).map(tx => ({
  date: tx.date,
  category: tx.category,
  amount: tx.amount,
  recipient: tx.recipient
})), null, 2)}

Erstelle eine Analyse mit:
1. Top Ausgaben-Kategorien
2. Größte einzelne Ausgaben
3. Regelmäßige Zahlungen
4. Ungewöhnliche Aktivitäten
5. Spar-Potentiale

Antworte mit strukturiertem JSON:
{
  "summary": {
    "total_spent": -1234.56,
    "total_income": 2500.00,
    "top_category": "groceries",
    "transaction_count": 45
  },
  "insights": [
    "Du gibst 35% deines Einkommens für Lebensmittel aus",
    "Netflix-Abo läuft seit 6 Monaten"
  ],
  "recommendations": [
    "Vergleiche Supermarkt-Preise",
    "Prüfe ungenutzte Abonnements"
  ]
}<|end|>
<|assistant|>`;

    try {
      const response = await this.query(prompt, {
        model: this.models.accurate,
        temperature: 0.3,
        max_tokens: 1000
      });
      
      return JSON.parse(response);
    } catch (error) {
      console.warn('Insights generation failed:', error);
      return null;
    }
  }

  // Basis-Methoden
  async query(prompt, options = {}) {
    if (!this.isAvailable) {
      throw new Error('Local LLM service not available');
    }

    const defaultOptions = {
      model: this.currentModel,
      temperature: 0.2,
      max_tokens: 500,
      stream: false
    };

    const requestOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: requestOptions.model,
          prompt: prompt,
          options: {
            temperature: requestOptions.temperature,
            num_predict: requestOptions.max_tokens
          },
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.response?.trim() || '';

    } catch (error) {
      console.error('LLM query failed:', error);
      throw error;
    }
  }

  // Model Management
  async switchModel(modelType) {
    if (this.models[modelType]) {
      this.currentModel = this.models[modelType];
      await this.pullModelIfNeeded(this.currentModel);
    }
  }

  async getAvailableModels() {
    if (!this.isAvailable) return [];

    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models?.map(m => m.name) || [];
    } catch (error) {
      return [];
    }
  }

  // Batch Processing für bessere Performance
  async batchCategorize(transactions) {
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(tx => this.categorizeTransaction(tx))
      );
      results.push(...batchResults);
    }

    return results;
  }

  async batchImproveRecipients(transactions) {
    const results = [];
    
    for (const tx of transactions) {
      try {
        const improved = await this.improveRecipientName(tx.recipient, tx.description || '');
        results.push(improved);
      } catch (error) {
        results.push(tx.recipient);
      }
    }

    return results;
  }
}

export const localLLMService = new LocalLLMService();