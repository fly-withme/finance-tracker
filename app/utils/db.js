import Dexie from 'dexie';

export const db = new Dexie('ZenithFinanceDB');

// Version 8: Erweitert categories um parentId für Hierarchie
db.version(8).stores({
  transactions: '++id, date, category, recipient, account, amount, sharedWith, splitType, splitDetails',
  categories: '++id, &name, parentId',
  accounts: '++id, &name',
  settings: 'key', // Einfache Key-Value-Tabelle für Model, etc.
  inbox: '++id, date, recipient, account, amount, uploadedAt, skipped, [skipped+uploadedAt]', // Posteingang für unkategorisierte Transaktionen
  budgets: '++id, &categoryName, amount, month, year', // Budget pro Kategorie und Monat
  contacts: '++id, &name, color' // Kontakte für geteilte Ausgaben
}).upgrade(tx => {
  // Füge parentId Feld zu bestehenden Kategorien hinzu
  return tx.categories.toCollection().modify(category => {
    if (category.parentId === undefined) {
      category.parentId = null;
    }
  });
});

// Version 7: Erweitert inbox um skipped field und compound index
db.version(7).stores({
  transactions: '++id, date, category, recipient, account, amount, sharedWith, splitType, splitDetails',
  categories: '++id, &name',
  accounts: '++id, &name',
  settings: 'key', // Einfache Key-Value-Tabelle für Model, etc.
  inbox: '++id, date, recipient, account, amount, uploadedAt, skipped, [skipped+uploadedAt]', // Posteingang für unkategorisierte Transaktionen
  budgets: '++id, &categoryName, amount, month, year', // Budget pro Kategorie und Monat
  contacts: '++id, &name, color' // Kontakte für geteilte Ausgaben
});

// Version 6: Erweitert transactions um shared expenses Felder
db.version(6).stores({
  transactions: '++id, date, category, recipient, account, amount, sharedWith, splitType, splitDetails',
  categories: '++id, &name',
  accounts: '++id, &name',
  settings: 'key', // Einfache Key-Value-Tabelle für Model, etc.
  inbox: '++id, date, recipient, account, amount, uploadedAt', // Posteingang für unkategorisierte Transaktionen
  budgets: '++id, &categoryName, amount, month, year', // Budget pro Kategorie und Monat
  contacts: '++id, &name, color' // Kontakte für geteilte Ausgaben
});

// GEÄNDERT: Version auf 5 für Migration beibehalten
db.version(5).stores({
  transactions: '++id, date, category, recipient, account, amount',
  categories: '++id, &name',
  accounts: '++id, &name',
  settings: 'key', // Einfache Key-Value-Tabelle für Model, etc.
  inbox: '++id, date, recipient, account, amount, uploadedAt', // Posteingang für unkategorisierte Transaktionen
  budgets: '++id, &categoryName, amount, month, year' // Budget pro Kategorie und Monat
});

// Definition für Version 4 beibehalten für die Migration
db.version(4).stores({
  transactions: '++id, date, category, recipient, account, amount',
  categories: '++id, &name',
  accounts: '++id, &name',
  settings: 'key',
  inbox: '++id, date, recipient, account, amount, uploadedAt'
});

// Definition für Version 3 beibehalten für die Migration
db.version(3).stores({
  transactions: '++id, date, category, recipient, account, amount',
  categories: '++id, &name',
  accounts: '++id, &name',
  settings: 'key'
});

// Definition für Version 2 beibehalten für die Migration
db.version(2).stores({
  transactions: '++id, date, category, recipient, account, amount',
  categories: '++id, &name',
  accounts: '++id, &name'
});

db.version(1).stores({
  transactions: '++id, date, category, account, amount',
  categories: '++id, &name',
  accounts: '++id, &name'
});


export async function populateInitialData(initialData) {
  const transactionCount = await db.transactions.count();
  const categoryCount = await db.categories.count();
  const accountCount = await db.accounts.count();
  const budgetCount = await db.budgets.count();
  const contactCount = await db.contacts.count();
  
  try {
    await db.transaction('rw', db.transactions, db.categories, db.accounts, db.budgets, db.contacts, async () => {
      // Nur Transaktionen hinzufügen wenn leer
      if (transactionCount === 0 && initialData.initialTransactions?.length > 0) {
        await db.transactions.bulkAdd(initialData.initialTransactions);
        console.log("Initiale Transaktionen hinzugefügt.");
      }
      
      // Kategorien einzeln prüfen und hinzufügen
      if (categoryCount === 0 && initialData.initialCategories?.length > 0) {
        for (const category of initialData.initialCategories) {
          try {
            await db.categories.add(category);
          } catch (error) {
            if (error.name !== 'ConstraintError') {
              console.error('Fehler beim Hinzufügen der Kategorie:', category.name, error);
            }
          }
        }
        console.log("Initiale Kategorien hinzugefügt.");
      }
      
      // Konten einzeln prüfen und hinzufügen
      if (accountCount === 0 && initialData.initialAccounts?.length > 0) {
        for (const account of initialData.initialAccounts) {
          try {
            await db.accounts.add(account);
          } catch (error) {
            if (error.name !== 'ConstraintError') {
              console.error('Fehler beim Hinzufügen des Kontos:', account.name, error);
            }
          }
        }
        console.log("Initiale Konten hinzugefügt.");
      }
      
      // Beispiel-Budgets hinzufügen
      if (budgetCount === 0) {
        const currentDate = new Date();
        const initialBudgets = [
          { categoryName: 'Wohnen', amount: 350, month: currentDate.getMonth(), year: currentDate.getFullYear() },
          { categoryName: 'Essen', amount: 100, month: currentDate.getMonth(), year: currentDate.getFullYear() },
          { categoryName: 'Shopping', amount: 50, month: currentDate.getMonth(), year: currentDate.getFullYear() },
          { categoryName: 'Hund', amount: 20, month: currentDate.getMonth(), year: currentDate.getFullYear() }
        ];
        
        for (const budget of initialBudgets) {
          try {
            await db.budgets.add(budget);
          } catch (error) {
            if (error.name !== 'ConstraintError') {
              console.error('Fehler beim Hinzufügen des Budgets:', budget.categoryName, error);
            }
          }
        }
        console.log("Initiale Budgets hinzugefügt.");
      }
      
      // Beispiel-Kontakte hinzufügen
      if (contactCount === 0) {
        const initialContacts = [
          { name: 'Anna', color: '#4F46E5' },
          { name: 'Max', color: '#7C3AED' },
          { name: 'Sarah', color: '#EC4899' },
          { name: 'Tom', color: '#06B6D4' },
          { name: 'Lisa', color: '#10B981' }
        ];
        
        for (const contact of initialContacts) {
          try {
            await db.contacts.add(contact);
          } catch (error) {
            if (error.name !== 'ConstraintError') {
              console.error('Fehler beim Hinzufügen des Kontakts:', contact.name, error);
            }
          }
        }
        console.log("Initiale Kontakte hinzugefügt.");
      }
    });
  } catch (error) {
    console.error("Fehler beim Hinzufügen der initialen Daten:", error);
  }
}