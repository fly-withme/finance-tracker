// Fehlerbehandlung und User-Feedback für PDF-Parsing und allgemeine App-Funktionen

export class ParseError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.details = details;
    this.userMessage = this.getUserFriendlyMessage();
  }
  
  getUserFriendlyMessage() {
    switch (this.code) {
      case 'PDF_EMPTY':
        return 'Das PDF scheint leer zu sein oder enthält keinen lesbaren Text. Bitte überprüfen Sie, ob es sich um einen echten Kontoauszug handelt.';
        
      case 'PDF_CORRUPTED':
        return 'Das PDF konnte nicht gelesen werden. Möglicherweise ist die Datei beschädigt. Bitte versuchen Sie es mit einer anderen Datei.';
        
      case 'BANK_NOT_SUPPORTED':
        return `Der Kontoauszug von "${this.details.bankName}" wird noch nicht unterstützt. Derzeit unterstützen wir ING-DiBa und Vivid Money. Weitere Banken folgen bald!`;
        
      case 'NO_TRANSACTIONS_FOUND':
        return 'Es konnten keine Transaktionen in diesem Dokument gefunden werden. Stellen Sie sicher, dass es sich um einen vollständigen Kontoauszug handelt.';
        
      case 'PARTIAL_PARSE_FAILURE':
        return `Nur ${this.details.successCount} von ${this.details.totalCount} Transaktionen konnten erfolgreich verarbeitet werden. Die anderen enthalten möglicherweise unvollständige Daten.`;
        
      case 'DATE_PARSE_ERROR':
        return 'Einige Datumsangaben konnten nicht korrekt interpretiert werden. Bitte überprüfen Sie die verarbeiteten Transaktionen.';
        
      case 'AMOUNT_PARSE_ERROR':
        return 'Einige Beträge konnten nicht korrekt interpretiert werden. Bitte überprüfen Sie die Beträge in den verarbeiteten Transaktionen.';
        
      case 'FILE_TOO_LARGE':
        return `Die Datei ist zu groß (${this.details.size}MB). Bitte verwenden Sie Dateien unter 10MB.`;
        
      case 'INVALID_FILE_TYPE':
        return 'Nur PDF-Dateien werden unterstützt. Bitte wählen Sie eine PDF-Datei aus.';
        
      default:
        return 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.';
    }
  }
  
  getRecommendations() {
    switch (this.code) {
      case 'BANK_NOT_SUPPORTED':
        return [
          'Versuchen Sie den Universal Parser (experimentell)',
          'Exportieren Sie den Kontoauszug als CSV, falls verfügbar',
          'Kontaktieren Sie uns für die Unterstützung Ihrer Bank'
        ];
        
      case 'NO_TRANSACTIONS_FOUND':
        return [
          'Stellen Sie sicher, dass das PDF vollständig ist',
          'Überprüfen Sie, ob es sich um einen Kontoauszug handelt',
          'Versuchen Sie es mit einem anderen Zeitraum'
        ];
        
      case 'PARTIAL_PARSE_FAILURE':
        return [
          'Überprüfen Sie die importierten Transaktionen im Posteingang',
          'Ergänzen Sie fehlende Daten manuell',
          'Versuchen Sie es mit einem anderen PDF-Export'
        ];
        
      default:
        return [
          'Versuchen Sie es mit einer anderen PDF-Datei',
          'Starten Sie die App neu',
          'Kontaktieren Sie den Support, wenn das Problem weiterhin besteht'
        ];
    }
  }
}

// Erweiterte Parser-Wrapper Klasse mit robuster Fehlerbehandlung
export class RobustPDFParser {
  constructor(bankStatementParser) {
    this.parser = bankStatementParser;
    this.supportedBanks = ['ING', 'Vivid', 'Unknown'];
  }
  
  async parseFileWithErrorHandling(file, progressCallback = null) {
    try {
      // Datei-Validierung
      this.validateFile(file);
      
      if (progressCallback) progressCallback('Validiere Datei...');
      
      // Versuche Parser
      const result = await this.attemptParsing(file, progressCallback);
      
      // Validiere Ergebnis
      this.validateParseResult(result);
      
      return {
        success: true,
        transactions: result,
        warnings: this.generateWarnings(result),
        bankDetected: this.detectBankFromTransactions(result)
      };
      
    } catch (error) {
      console.error('Parse error:', error);
      
      if (error instanceof ParseError) {
        return {
          success: false,
          error: error,
          recommendations: error.getRecommendations(),
          fallbackOptions: this.getFallbackOptions(error)
        };
      }
      
      // Unbekannte Fehler wrappen
      const wrappedError = new ParseError(
        'Ein unerwarteter Fehler ist aufgetreten',
        'UNKNOWN_ERROR',
        { originalError: error.message }
      );
      
      return {
        success: false,
        error: wrappedError,
        recommendations: wrappedError.getRecommendations(),
        fallbackOptions: ['manual_entry', 'csv_import', 'contact_support']
      };
    }
  }
  
  validateFile(file) {
    // Dateityp prüfen
    if (!file.type.includes('pdf')) {
      throw new ParseError(
        'Invalid file type',
        'INVALID_FILE_TYPE',
        { fileType: file.type }
      );
    }
    
    // Dateigröße prüfen (10MB Limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new ParseError(
        'File too large',
        'FILE_TOO_LARGE',
        { size: (file.size / 1024 / 1024).toFixed(2) }
      );
    }
  }
  
  async attemptParsing(file, progressCallback) {
    try {
      // Hauptparser verwenden
      const result = await this.parser.parseFile(file, progressCallback);
      
      if (!result || result.length === 0) {
        throw new ParseError(
          'No transactions found',
          'NO_TRANSACTIONS_FOUND'
        );
      }
      
      return result;
      
    } catch (error) {
      if (error.message.includes('empty') || error.message.includes('no readable text')) {
        throw new ParseError(
          'PDF is empty or unreadable',
          'PDF_EMPTY'
        );
      }
      
      if (error.message.includes('Failed to parse PDF')) {
        throw new ParseError(
          'PDF is corrupted or unreadable',
          'PDF_CORRUPTED'
        );
      }
      
      // Weiterleiten unbekannter Fehler
      throw error;
    }
  }
  
  validateParseResult(result) {
    if (!Array.isArray(result)) {
      throw new ParseError(
        'Invalid parse result format',
        'INVALID_RESULT_FORMAT'
      );
    }
    
    // Prüfe auf teilweise erfolgreiche Extraktion
    const validTransactions = result.filter(tx => 
      tx.date && tx.amount !== null && tx.recipient
    );
    
    if (validTransactions.length < result.length) {
      throw new ParseError(
        'Partial parsing failure',
        'PARTIAL_PARSE_FAILURE',
        { 
          successCount: validTransactions.length,
          totalCount: result.length
        }
      );
    }
    
    // Prüfe auf Datumsfehler
    const invalidDates = result.filter(tx => 
      !tx.date || tx.date === '1970-01-01'
    );
    
    if (invalidDates.length > 0) {
      throw new ParseError(
        'Date parsing errors detected',
        'DATE_PARSE_ERROR',
        { invalidCount: invalidDates.length }
      );
    }
    
    // Prüfe auf Betragsfehler
    const invalidAmounts = result.filter(tx => 
      tx.amount === null || isNaN(tx.amount)
    );
    
    if (invalidAmounts.length > 0) {
      throw new ParseError(
        'Amount parsing errors detected',
        'AMOUNT_PARSE_ERROR',
        { invalidCount: invalidAmounts.length }
      );
    }
  }
  
  generateWarnings(transactions) {
    const warnings = [];
    
    // Warnung bei sehr alten Transaktionen
    const oldTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      return txDate < twoYearsAgo;
    });
    
    if (oldTransactions.length > 0) {
      warnings.push({
        type: 'old_transactions',
        message: `${oldTransactions.length} Transaktionen sind älter als 2 Jahre`,
        severity: 'info'
      });
    }
    
    // Warnung bei sehr hohen Beträgen
    const highAmountTransactions = transactions.filter(tx => 
      Math.abs(tx.amount) > 10000
    );
    
    if (highAmountTransactions.length > 0) {
      warnings.push({
        type: 'high_amounts',
        message: `${highAmountTransactions.length} Transaktionen haben ungewöhnlich hohe Beträge`,
        severity: 'warning'
      });
    }
    
    // Warnung bei fehlenden Beschreibungen
    const missingDescriptions = transactions.filter(tx => 
      !tx.description || tx.description.trim().length < 3
    );
    
    if (missingDescriptions.length > 0) {
      warnings.push({
        type: 'missing_descriptions',
        message: `${missingDescriptions.length} Transaktionen haben keine oder unvollständige Beschreibungen`,
        severity: 'info'
      });
    }
    
    return warnings;
  }
  
  detectBankFromTransactions(transactions) {
    if (!transactions.length) return 'Unknown';
    
    // Nimm die Bank vom ersten Transaktion
    const account = transactions[0].account;
    
    if (account?.includes('ING')) return 'ING-DiBa';
    if (account?.includes('Vivid')) return 'Vivid Money';
    
    return 'Unknown';
  }
  
  getFallbackOptions(error) {
    switch (error.code) {
      case 'BANK_NOT_SUPPORTED':
        return ['universal_parser', 'csv_import', 'manual_entry'];
        
      case 'PDF_CORRUPTED':
        return ['re_export_pdf', 'csv_export', 'manual_entry'];
        
      case 'NO_TRANSACTIONS_FOUND':
        return ['check_date_range', 'try_different_export', 'manual_entry'];
        
      default:
        return ['manual_entry', 'contact_support'];
    }
  }
}

// User-freundliche Notification-System
export class NotificationManager {
  constructor() {
    this.notifications = [];
    this.listeners = [];
  }
  
  showSuccess(message, duration = 5000) {
    this.addNotification({
      type: 'success',
      message,
      duration,
      icon: '✅'
    });
  }
  
  showError(message, actions = [], duration = 8000) {
    this.addNotification({
      type: 'error',
      message,
      actions,
      duration,
      icon: '❌'
    });
  }
  
  showWarning(message, duration = 6000) {
    this.addNotification({
      type: 'warning',
      message,
      duration,
      icon: '⚠️'
    });
  }
  
  showInfo(message, duration = 4000) {
    this.addNotification({
      type: 'info',
      message,
      duration,
      icon: 'ℹ️'
    });
  }
  
  showProgress(message, progress = 0) {
    this.addNotification({
      type: 'progress',
      message,
      progress,
      duration: 0, // No auto-dismiss
      icon: '⏳'
    });
  }
  
  addNotification(notification) {
    const id = Date.now() + Math.random();
    const fullNotification = {
      ...notification,
      id,
      timestamp: new Date()
    };
    
    this.notifications.push(fullNotification);
    this.notifyListeners();
    
    // Auto-dismiss
    if (notification.duration > 0) {
      setTimeout(() => {
        this.dismissNotification(id);
      }, notification.duration);
    }
    
    return id;
  }
  
  dismissNotification(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }
  
  clearAll() {
    this.notifications = [];
    this.notifyListeners();
  }
  
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  notifyListeners() {
    this.listeners.forEach(listener => {
      listener(this.notifications);
    });
  }
}

// Singleton Notification Manager
export const notificationManager = new NotificationManager();

// Helper für häufige Szenarien
export const showParseResult = (result) => {
  if (result.success) {
    notificationManager.showSuccess(
      `${result.transactions.length} Transaktionen erfolgreich importiert!`
    );
    
    // Zeige Warnungen
    result.warnings?.forEach(warning => {
      if (warning.severity === 'warning') {
        notificationManager.showWarning(warning.message);
      } else {
        notificationManager.showInfo(warning.message);
      }
    });
    
  } else {
    notificationManager.showError(
      result.error.userMessage,
      result.recommendations?.map(rec => ({
        label: rec,
        action: () => console.log('Recommendation clicked:', rec)
      }))
    );
  }
};

export default { ParseError, RobustPDFParser, NotificationManager, notificationManager, showParseResult };