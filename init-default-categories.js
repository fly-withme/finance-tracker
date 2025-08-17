// Standardkategorien für bessere UX initialisieren

import { db } from './app/utils/db.js';

const defaultCategories = [
  // Einnahmen
  { name: 'Gehalt', parentId: null, description: 'Regelmäßiges Einkommen' },
  { name: 'Bonus', parentId: null, description: 'Einmalige Bonuszahlungen' },
  { name: 'Rückerstattung', parentId: null, description: 'Erstattungen und Rückzahlungen' },
  
  // Wohnen (Hauptkategorie)
  { name: 'Wohnen', parentId: null, description: 'Alle wohnungsbezogenen Ausgaben' },
  
  // Transport
  { name: 'Transport', parentId: null, description: 'Alle transportbezogenen Ausgaben' },
  
  // Lebensmittel & Restaurants
  { name: 'Lebensmittel', parentId: null, description: 'Einkäufe für den täglichen Bedarf' },
  { name: 'Restaurants', parentId: null, description: 'Essen außer Haus' },
  
  // Gesundheit
  { name: 'Gesundheit', parentId: null, description: 'Medizinische Ausgaben' },
  
  // Entertainment
  { name: 'Entertainment', parentId: null, description: 'Freizeit und Unterhaltung' },
  
  // Versicherungen
  { name: 'Versicherungen', parentId: null, description: 'Alle Versicherungsbeiträge' },
  
  // Steuern & Abgaben
  { name: 'Steuern & Abgaben', parentId: null, description: 'Steuern und öffentliche Abgaben' },
  
  // Shopping
  { name: 'Shopping', parentId: null, description: 'Kleidung und persönliche Artikel' },
  
  // Bildung
  { name: 'Bildung', parentId: null, description: 'Kurse, Bücher, Weiterbildung' },
  
  // Sparen & Investieren
  { name: 'Sparen', parentId: null, description: 'Sparpläne und Geldanlage' },
  
  // Sonstiges
  { name: 'Sonstiges', parentId: null, description: 'Nicht kategorisierte Ausgaben' }
];

// Spezifische Unterkategorien für häufige Ausgaben
const subCategories = [
  // Wohnen Unterkategorien
  { name: 'Miete', parentId: 'Wohnen', description: 'Monatliche Mietzahlungen' },
  { name: 'Nebenkosten', parentId: 'Wohnen', description: 'Strom, Gas, Wasser' },
  { name: 'Internet & Telefon', parentId: 'Wohnen', description: 'Telekommunikation' },
  { name: 'Hausratversicherung', parentId: 'Wohnen', description: 'Versicherung für Hausrat' },
  { name: 'GEZ', parentId: 'Wohnen', description: 'Rundfunkbeitrag' },
  
  // Transport Unterkategorien
  { name: 'Öffentliche Verkehrsmittel', parentId: 'Transport', description: 'Bus, Bahn, etc.' },
  { name: 'Taxi & Rideshare', parentId: 'Transport', description: 'Taxi, Uber, etc.' },
  { name: 'Benzin', parentId: 'Transport', description: 'Tankstellenbesuche' },
  { name: 'Parkgebühren', parentId: 'Transport', description: 'Parken und Maut' },
  
  // Gesundheit Unterkategorien
  { name: 'Apotheke', parentId: 'Gesundheit', description: 'Medikamente und Gesundheitsprodukte' },
  { name: 'Arztbesuch', parentId: 'Gesundheit', description: 'Arztkosten und Behandlungen' },
  { name: 'Krankenversicherung', parentId: 'Gesundheit', description: 'Krankenversicherungsbeiträge' },
  
  // Entertainment Unterkategorien
  { name: 'Streaming', parentId: 'Entertainment', description: 'Netflix, Spotify, etc.' },
  { name: 'Kino & Theater', parentId: 'Entertainment', description: 'Kulturelle Veranstaltungen' },
  { name: 'Sport & Fitness', parentId: 'Entertainment', description: 'Fitnessstudio, Sportverein' },
  { name: 'Hobbys', parentId: 'Entertainment', description: 'Hobby-bezogene Ausgaben' }
];

async function initializeDefaultCategories() {
  console.log('🏷️ STANDARDKATEGORIEN INITIALISIERUNG');
  console.log('====================================');
  
  try {
    // Prüfe ob bereits Kategorien existieren
    const existingCategories = await db.categories.count();
    console.log(`Vorhandene Kategorien: ${existingCategories}`);
    
    if (existingCategories > 0) {
      console.log('✅ Kategorien bereits vorhanden - keine Initialisierung nötig');
      return;
    }
    
    // Füge Hauptkategorien hinzu
    console.log('\n📂 Erstelle Hauptkategorien...');
    const categoryMap = new Map(); // name -> id mapping
    
    for (const category of defaultCategories) {
      try {
        const id = await db.categories.add({
          name: category.name,
          parentId: null,
          description: category.description
        });
        categoryMap.set(category.name, id);
        console.log(`✅ ${category.name} (ID: ${id})`);
      } catch (error) {
        console.log(`❌ Fehler bei ${category.name}: ${error.message}`);
      }
    }
    
    // Füge Unterkategorien hinzu
    console.log('\n📁 Erstelle Unterkategorien...');
    for (const subCat of subCategories) {
      try {
        const parentId = categoryMap.get(subCat.parentId);
        if (parentId) {
          const id = await db.categories.add({
            name: subCat.name,
            parentId: parentId,
            description: subCat.description
          });
          console.log(`✅ ${subCat.name} → ${subCat.parentId} (ID: ${id})`);
        } else {
          console.log(`❌ Parent nicht gefunden für: ${subCat.name}`);
        }
      } catch (error) {
        console.log(`❌ Fehler bei ${subCat.name}: ${error.message}`);
      }
    }
    
    // Finale Statistik
    const totalCategories = await db.categories.count();
    console.log(`\n📊 ERGEBNIS:`);
    console.log(`✅ ${totalCategories} Kategorien erfolgreich erstellt`);
    console.log(`📂 ${defaultCategories.length} Hauptkategorien`);
    console.log(`📁 ${subCategories.length} Unterkategorien`);
    
    console.log('\n🎉 SUCCESS: Standardkategorien erfolgreich initialisiert!');
    console.log('Die App ist jetzt bereit für die erste Nutzung.');
    
  } catch (error) {
    console.error('❌ FEHLER bei der Kategorien-Initialisierung:', error);
    throw error;
  }
}

// Zusätzliche Funktion: Smart Category Suggestions
async function suggestCategoryForTransaction(description, recipient) {
  console.log(`🤖 Kategorie-Vorschlag für: "${description}" (${recipient})`);
  
  const suggestions = [];
  
  // Einfache Keyword-basierte Vorschläge
  const keywordMappings = {
    'miete': 'Miete',
    'gehalt': 'Gehalt',
    'lohn': 'Gehalt',
    'gas': 'Nebenkosten',
    'strom': 'Nebenkosten',
    'gez': 'GEZ',
    'rewe': 'Lebensmittel',
    'aldi': 'Lebensmittel',
    'edeka': 'Lebensmittel',
    'tankstelle': 'Benzin',
    'taxi': 'Taxi & Rideshare',
    'apotheke': 'Apotheke',
    'krankenkasse': 'Krankenversicherung',
    'netflix': 'Streaming',
    'spotify': 'Streaming',
    'amazon': 'Shopping',
    'fitness': 'Sport & Fitness',
    'restaurant': 'Restaurants',
    'café': 'Restaurants'
  };
  
  const searchText = `${description} ${recipient}`.toLowerCase();
  
  for (const [keyword, categoryName] of Object.entries(keywordMappings)) {
    if (searchText.includes(keyword)) {
      try {
        const category = await db.categories.where('name').equals(categoryName).first();
        if (category) {
          suggestions.push({
            category: category,
            confidence: 0.8,
            reason: `Keyword "${keyword}" gefunden`
          });
        }
      } catch (error) {
        console.log(`Warnung: Kategorie "${categoryName}" nicht gefunden`);
      }
    }
  }
  
  return suggestions;
}

// Export für Verwendung in der App
export { initializeDefaultCategories, suggestCategoryForTransaction };

// Direkte Ausführung wenn Skript direkt aufgerufen wird
if (import.meta.url === new URL(import.meta.url).href) {
  initializeDefaultCategories()
    .then(() => {
      console.log('\n✅ Initialisierung abgeschlossen');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Initialisierung fehlgeschlagen:', error);
      process.exit(1);
    });
}