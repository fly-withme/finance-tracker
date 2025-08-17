// Daten-Export/Import System für vollständige Backup-Funktionalität
import { db } from './db.js';

const APP_VERSION = '1.0.0';
const BACKUP_VERSION = '1.0';

// Vollständiger Datenexport
export async function exportAllData() {
  try {
    console.log('📦 Starte vollständigen Datenexport...');
    
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        appVersion: APP_VERSION,
        backupVersion: BACKUP_VERSION,
        totalTransactions: 0,
        totalCategories: 0,
        dataIntegrity: null
      },
      transactions: [],
      categories: [],
      accounts: [],
      settings: {},
      inbox: [],
      budgets: [],
      contacts: []
    };
    
    // Exportiere alle Tabellen
    exportData.transactions = await db.transactions.toArray();
    exportData.categories = await db.categories.toArray();
    exportData.accounts = await db.accounts.toArray();
    exportData.inbox = await db.inbox.toArray();
    exportData.budgets = await db.budgets.toArray();
    exportData.contacts = await db.contacts.toArray();
    
    // Exportiere Settings (Key-Value Paare)
    const settingsArray = await db.settings.toArray();
    settingsArray.forEach(setting => {
      exportData.settings[setting.key] = setting.value;
    });
    
    // Metadata aktualisieren
    exportData.metadata.totalTransactions = exportData.transactions.length;
    exportData.metadata.totalCategories = exportData.categories.length;
    exportData.metadata.dataIntegrity = generateDataIntegrityHash(exportData);
    
    console.log(`✅ Export erfolgreich: ${exportData.transactions.length} Transaktionen, ${exportData.categories.length} Kategorien`);
    
    return exportData;
    
  } catch (error) {
    console.error('❌ Fehler beim Datenexport:', error);
    throw new Error(`Datenexport fehlgeschlagen: ${error.message}`);
  }
}

// Vollständiger Datenimport
export async function importAllData(importData, options = {}) {
  const { 
    skipExisting = false, 
    clearBeforeImport = false,
    validateIntegrity = true 
  } = options;
  
  try {
    console.log('📥 Starte vollständigen Datenimport...');
    
    // Validierung
    validateImportData(importData, validateIntegrity);
    
    // Backup der aktuellen Daten erstellen
    const currentBackup = await exportAllData();
    
    // Optional: Aktuelle Daten löschen
    if (clearBeforeImport) {
      console.log('🗑️ Lösche aktuelle Daten...');
      await clearAllData();
    }
    
    const importStats = {
      transactions: { imported: 0, skipped: 0, errors: 0 },
      categories: { imported: 0, skipped: 0, errors: 0 },
      accounts: { imported: 0, skipped: 0, errors: 0 },
      inbox: { imported: 0, skipped: 0, errors: 0 },
      budgets: { imported: 0, skipped: 0, errors: 0 },
      contacts: { imported: 0, skipped: 0, errors: 0 },
      settings: { imported: 0, skipped: 0, errors: 0 }
    };
    
    // Kategorien zuerst importieren (wegen Foreign Keys)
    if (importData.categories?.length) {
      importStats.categories = await importTable('categories', importData.categories, skipExisting);
    }
    
    // Accounts importieren
    if (importData.accounts?.length) {
      importStats.accounts = await importTable('accounts', importData.accounts, skipExisting);
    }
    
    // Contacts importieren
    if (importData.contacts?.length) {
      importStats.contacts = await importTable('contacts', importData.contacts, skipExisting);
    }
    
    // Transaktionen importieren
    if (importData.transactions?.length) {
      importStats.transactions = await importTable('transactions', importData.transactions, skipExisting);
    }
    
    // Inbox importieren
    if (importData.inbox?.length) {
      importStats.inbox = await importTable('inbox', importData.inbox, skipExisting);
    }
    
    // Budgets importieren
    if (importData.budgets?.length) {
      importStats.budgets = await importTable('budgets', importData.budgets, skipExisting);
    }
    
    // Settings importieren
    if (importData.settings && Object.keys(importData.settings).length) {
      importStats.settings = await importSettings(importData.settings, skipExisting);
    }
    
    console.log('✅ Import erfolgreich abgeschlossen');
    console.log('📊 Import-Statistiken:', importStats);
    
    return {
      success: true,
      stats: importStats,
      backup: currentBackup // Für Rollback
    };
    
  } catch (error) {
    console.error('❌ Fehler beim Datenimport:', error);
    throw new Error(`Datenimport fehlgeschlagen: ${error.message}`);
  }
}

// CSV Export für Excel/Numbers Kompatibilität
export async function exportTransactionsToCSV(dateRange = null) {
  try {
    console.log('📊 Exportiere Transaktionen als CSV...');
    
    let query = db.transactions.orderBy('date');
    
    if (dateRange) {
      query = query.where('date').between(dateRange.start, dateRange.end);
    }
    
    const transactions = await query.toArray();
    
    // CSV Header
    const csvHeader = [
      'Datum',
      'Kategorie', 
      'Empfänger',
      'Beschreibung',
      'Betrag',
      'Konto',
      'Geteilt mit',
      'Split-Type',
      'Notizen'
    ];
    
    // CSV Zeilen
    const csvRows = transactions.map(tx => [
      tx.date,
      tx.category || '',
      tx.recipient || '',
      tx.description || '',
      tx.amount?.toFixed(2) || '0.00',
      tx.account || '',
      tx.sharedWith || '',
      tx.splitType || '',
      tx.notes || ''
    ]);
    
    // CSV zusammenbauen
    const csvContent = [csvHeader, ...csvRows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    console.log(`✅ CSV Export: ${transactions.length} Transaktionen`);
    
    return {
      content: csvContent,
      filename: `zenith-finance-export-${new Date().toISOString().slice(0, 10)}.csv`,
      count: transactions.length
    };
    
  } catch (error) {
    console.error('❌ Fehler beim CSV Export:', error);
    throw new Error(`CSV Export fehlgeschlagen: ${error.message}`);
  }
}

// Hilfsfunktionen
async function importTable(tableName, data, skipExisting) {
  const stats = { imported: 0, skipped: 0, errors: 0 };
  const table = db[tableName];
  
  for (const item of data) {
    try {
      if (skipExisting) {
        // Prüfe ob Item bereits existiert
        const existing = await findExistingItem(tableName, item);
        if (existing) {
          stats.skipped++;
          continue;
        }
      }
      
      // Entferne ID für neue Items (wird auto-generiert)
      const { id, ...itemWithoutId } = item;
      await table.add(itemWithoutId);
      stats.imported++;
      
    } catch (error) {
      console.warn(`Import-Fehler für ${tableName}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

async function importSettings(settings, skipExisting) {
  const stats = { imported: 0, skipped: 0, errors: 0 };
  
  for (const [key, value] of Object.entries(settings)) {
    try {
      if (skipExisting) {
        const existing = await db.settings.where('key').equals(key).first();
        if (existing) {
          stats.skipped++;
          continue;
        }
      }
      
      await db.settings.put({ key, value });
      stats.imported++;
      
    } catch (error) {
      console.warn(`Import-Fehler für Setting ${key}:`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

async function findExistingItem(tableName, item) {
  switch (tableName) {
    case 'transactions':
      // Transaktionen sind duplikate wenn Datum, Betrag und Empfänger gleich sind
      return await db.transactions
        .where(['date', 'amount', 'recipient'])
        .equals([item.date, item.amount, item.recipient])
        .first();
        
    case 'categories':
      // Kategorien sind unique by name
      return await db.categories.where('name').equals(item.name).first();
      
    case 'accounts':
      // Accounts sind unique by name
      return await db.accounts.where('name').equals(item.name).first();
      
    case 'contacts':
      // Contacts sind unique by name
      return await db.contacts.where('name').equals(item.name).first();
      
    default:
      return null;
  }
}

function validateImportData(data, validateIntegrity) {
  if (!data || typeof data !== 'object') {
    throw new Error('Ungültige Import-Daten');
  }
  
  if (!data.metadata) {
    throw new Error('Import-Metadaten fehlen');
  }
  
  if (validateIntegrity && data.metadata.dataIntegrity) {
    const currentHash = generateDataIntegrityHash(data);
    if (currentHash !== data.metadata.dataIntegrity) {
      throw new Error('Datenintegrität verletzt - Backup könnte beschädigt sein');
    }
  }
  
  // Prüfe Backup-Version Kompatibilität
  if (data.metadata.backupVersion && !isVersionCompatible(data.metadata.backupVersion)) {
    throw new Error(`Backup-Version ${data.metadata.backupVersion} ist nicht kompatibel`);
  }
}

function generateDataIntegrityHash(data) {
  // Einfacher Hash für Integritätsprüfung
  const hashData = {
    transactionCount: data.transactions?.length || 0,
    categoryCount: data.categories?.length || 0,
    settingsCount: Object.keys(data.settings || {}).length
  };
  
  return btoa(JSON.stringify(hashData));
}

function isVersionCompatible(backupVersion) {
  // Aktuell: Alle 1.x Versionen sind kompatibel
  return backupVersion.startsWith('1.');
}

async function clearAllData() {
  const tables = ['transactions', 'categories', 'accounts', 'inbox', 'budgets', 'contacts', 'settings'];
  
  for (const tableName of tables) {
    await db[tableName].clear();
  }
}

// Download-Helper für Browser
export function downloadBackupFile(backupData, filename) {
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `zenith-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSVFile(csvData) {
  const blob = new Blob([csvData.content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = csvData.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// File-Upload Helper
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.includes('json') && !file.name.endsWith('.json')) {
      reject(new Error('Nur JSON-Dateien werden unterstützt'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (error) {
        reject(new Error('Ungültige JSON-Datei'));
      }
    };
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
    reader.readAsText(file);
  });
}

export default {
  exportAllData,
  importAllData,
  exportTransactionsToCSV,
  downloadBackupFile,
  downloadCSVFile,
  readBackupFile
};