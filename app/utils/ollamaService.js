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

  async parseBankStatement(pdfText, bankType = 'vivid') {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new Error('Ollama service not available');
    }

    const prompt = this.createBankStatementPrompt(pdfText, bankType);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent structured output
            top_p: 0.9,
            num_ctx: 2048, // Reduced context for faster processing
            num_predict: 512, // Limit prediction length
            num_thread: -1, // Use all available threads
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseAIResponse(data.response);
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }

  createBankStatementPrompt(pdfText, bankType) {
    // Truncate text if too long for faster processing
    const maxLength = 1500;
    const truncatedText = pdfText.length > maxLength 
      ? pdfText.substring(0, maxLength) + '...' 
      : pdfText;
    
    return `Extract transactions as JSON from this ${bankType} bank statement.

Rules:
1. Return ONLY valid JSON array
2. No explanations
3. Clean recipient names (no IBANs)

Format:
[{"date":"YYYY-MM-DD","description":"Clean description","recipient":"Name","amount":-12.34}]

Text:
${truncatedText}

JSON:`;
  }

  parseAIResponse(aiResponse) {
    try {
      // Clean the response - remove any text before/after JSON
      let jsonText = aiResponse.trim();
      
      // Extract JSON array if it's wrapped in other text
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const transactions = JSON.parse(jsonText);
      
      if (!Array.isArray(transactions)) {
        throw new Error('Response is not an array');
      }

      // Validate and normalize each transaction
      return transactions
        .filter(t => this.isValidTransaction(t))
        .map((t, index) => this.normalizeTransaction(t, index));

    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Raw AI response:', aiResponse);
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
    return {
      id: Date.now() + Math.random() + index,
      date: this.normalizeDate(transaction.date),
      description: this.cleanText(transaction.description),
      recipient: this.cleanText(transaction.recipient),
      amount: Number(transaction.amount),
      account: 'Vivid Money (AI)',
      category: null,
      type: transaction.type || 'Unknown',
      rawText: transaction.rawText || ''
    };
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