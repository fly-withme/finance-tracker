export class UploadLogger {
  constructor() {
    this.logs = [];
    this.currentSession = null;
  }

  startSession(filename) {
    this.currentSession = {
      id: Date.now(),
      filename,
      startTime: new Date(),
      steps: [],
      errors: [],
      warnings: [],
      stats: {
        pdfPages: 0,
        extractedTextLength: 0,
        foundTransactions: 0,
        savedTransactions: 0,
        processingTime: 0
      }
    };
    
    this.log('INFO', `🚀 Upload-Session gestartet: ${filename}`);
    return this.currentSession.id;
  }

  log(level, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      sessionId: this.currentSession?.id
    };

    this.logs.push(logEntry);
    
    // Console output mit besserer Formatierung
    const emoji = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'WARNING': '⚠️',
      'ERROR': '❌',
      'DEBUG': '🔍'
    }[level] || '📝';
    
    console.log(`${emoji} [${level}] ${message}`, data ? data : '');
    
    if (this.currentSession) {
      this.currentSession.steps.push(logEntry);
      
      if (level === 'ERROR') {
        this.currentSession.errors.push(logEntry);
      } else if (level === 'WARNING') {
        this.currentSession.warnings.push(logEntry);
      }
    }
  }

  updateStats(key, value) {
    if (this.currentSession) {
      this.currentSession.stats[key] = value;
      this.log('DEBUG', `📊 Stats Update: ${key} = ${value}`);
    }
  }

  endSession(success = true) {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.processingTime = this.currentSession.endTime - this.currentSession.startTime;
      this.currentSession.success = success;
      
      this.log(success ? 'SUCCESS' : 'ERROR', 
        `🏁 Session beendet: ${success ? 'Erfolgreich' : 'Mit Fehlern'} in ${this.currentSession.processingTime}ms`);
      
      // Session zur History hinzufügen
      this.logs.push({
        type: 'SESSION_COMPLETE',
        session: { ...this.currentSession }
      });
      
      const result = { ...this.currentSession };
      this.currentSession = null;
      return result;
    }
  }

  logPDFExtraction(pages, textLength) {
    this.updateStats('pdfPages', pages);
    this.updateStats('extractedTextLength', textLength);
    this.log('INFO', `📄 PDF-Text extrahiert: ${pages} Seiten, ${textLength} Zeichen`);
  }

  logLLMRequest(bankType, promptLength, model) {
    this.log('INFO', `🤖 LLM-Anfrage: Bank=${bankType}, Model=${model}, Prompt=${promptLength} Zeichen`);
  }

  logLLMResponse(transactions, processingTime) {
    this.updateStats('foundTransactions', transactions.length);
    this.log('SUCCESS', `🎯 LLM-Antwort: ${transactions.length} Transaktionen in ${processingTime}ms`);
    
    // Log der gefundenen Transaktionen
    transactions.forEach((tx, i) => {
      this.log('DEBUG', `  ${i+1}. ${tx.date} | ${tx.recipient} | ${tx.amount}€ | ${tx.category || 'Ohne Kategorie'}`);
    });
  }

  logRuleBasedFallback(reason) {
    this.log('WARNING', `⚠️ Fallback zu Regel-basierter Extraktion: ${reason}`);
  }

  logCategoriesUsed(categories) {
    this.log('INFO', `🏷️ Verfügbare Kategorien: ${categories.length} Stück`);
    this.log('DEBUG', `Kategorien: ${categories.map(c => c.name).join(', ')}`);
  }

  logSaveResults(saved, skipped) {
    this.updateStats('savedTransactions', saved);
    this.log('SUCCESS', `💾 Gespeichert: ${saved} Transaktionen, Übersprungen: ${skipped}`);
  }

  getSessionSummary() {
    if (!this.currentSession) return null;
    
    return {
      filename: this.currentSession.filename,
      duration: Date.now() - this.currentSession.startTime.getTime(),
      steps: this.currentSession.steps.length,
      errors: this.currentSession.errors.length,
      warnings: this.currentSession.warnings.length,
      stats: this.currentSession.stats
    };
  }

  getRecentSessions(limit = 5) {
    return this.logs
      .filter(log => log.type === 'SESSION_COMPLETE')
      .slice(-limit)
      .map(log => ({
        id: log.session.id,
        filename: log.session.filename,
        success: log.session.success,
        duration: log.session.processingTime,
        transactions: log.session.stats.foundTransactions,
        errors: log.session.errors.length
      }));
  }

  exportLogs() {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalSessions: this.logs.filter(l => l.type === 'SESSION_COMPLETE').length,
      recentLogs: this.logs.slice(-100), // Last 100 logs
      currentSession: this.currentSession
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenith-upload-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearLogs() {
    this.logs = [];
    this.log('INFO', '🗑️ Log-History gelöscht');
  }
}

// Singleton instance
export const uploadLogger = new UploadLogger();