// Standardkategorien und smarte Kategorisierungs-Funktionen
import { db } from './db.js';

const defaultCategories = [
  // Einnahmen
  { name: 'Gehalt', parentId: null, color: '#10B981', icon: '💰' },
  { name: 'Bonus', parentId: null, color: '#8B5CF6', icon: '🎁' },
  { name: 'Rückerstattung', parentId: null, color: '#06B6D4', icon: '↩️' },
  
  // Wohnen (Hauptkategorie)
  { name: 'Wohnen', parentId: null, color: '#EF4444', icon: '🏠' },
  { name: 'Miete', parentId: 'Wohnen', color: '#DC2626', icon: '🏠' },
  { name: 'Nebenkosten', parentId: 'Wohnen', color: '#F97316', icon: '⚡' },
  { name: 'Internet & Telefon', parentId: 'Wohnen', color: '#3B82F6', icon: '📞' },
  { name: 'GEZ', parentId: 'Wohnen', color: '#6B7280', icon: '📺' },
  
  // Transport
  { name: 'Transport', parentId: null, color: '#F59E0B', icon: '🚗' },
  { name: 'Öffentliche Verkehrsmittel', parentId: 'Transport', color: '#10B981', icon: '🚌' },
  { name: 'Taxi & Rideshare', parentId: 'Transport', color: '#F59E0B', icon: '🚕' },
  { name: 'Benzin', parentId: 'Transport', color: '#EF4444', icon: '⛽' },
  
  // Lebensmittel & Restaurants
  { name: 'Lebensmittel', parentId: null, color: '#22C55E', icon: '🛒' },
  { name: 'Restaurants', parentId: null, color: '#F97316', icon: '🍽️' },
  
  // Gesundheit
  { name: 'Gesundheit', parentId: null, color: '#EF4444', icon: '🏥' },
  { name: 'Apotheke', parentId: 'Gesundheit', color: '#DC2626', icon: '💊' },
  { name: 'Krankenversicherung', parentId: 'Gesundheit', color: '#B91C1C', icon: '🩺' },
  
  // Entertainment
  { name: 'Entertainment', parentId: null, color: '#8B5CF6', icon: '🎬' },
  { name: 'Streaming', parentId: 'Entertainment', color: '#7C3AED', icon: '📺' },
  { name: 'Sport & Fitness', parentId: 'Entertainment', color: '#059669', icon: '💪' },
  
  // Versicherungen
  { name: 'Versicherungen', parentId: null, color: '#6B7280', icon: '🛡️' },
  
  // Steuern & Abgaben
  { name: 'Steuern & Abgaben', parentId: null, color: '#374151', icon: '🏛️' },
  
  // Shopping
  { name: 'Shopping', parentId: null, color: '#EC4899', icon: '🛍️' },
  
  // Sonstiges
  { name: 'Sonstiges', parentId: null, color: '#9CA3AF', icon: '❓' }
];

// Smart Category Mapping für automatische Vorschläge
const smartCategoryMappings = {
  // Gehalt & Einkommen
  'gehalt': { category: 'Gehalt', confidence: 0.95 },
  'lohn': { category: 'Gehalt', confidence: 0.95 },
  'salary': { category: 'Gehalt', confidence: 0.95 },
  'atruvia': { category: 'Gehalt', confidence: 0.90 }, // Aus dem Vivid PDF
  'bonus': { category: 'Bonus', confidence: 0.90 },
  
  // Wohnen
  'miete': { category: 'Miete', confidence: 0.95 },
  'rent': { category: 'Miete', confidence: 0.95 },
  'gas': { category: 'Nebenkosten', confidence: 0.90 },
  'strom': { category: 'Nebenkosten', confidence: 0.90 },
  'stadtwerke': { category: 'Nebenkosten', confidence: 0.85 },
  'gez': { category: 'GEZ', confidence: 0.95 },
  'internet': { category: 'Internet & Telefon', confidence: 0.85 },
  'telefon': { category: 'Internet & Telefon', confidence: 0.85 },
  
  // Lebensmittel
  'rewe': { category: 'Lebensmittel', confidence: 0.95 },
  'aldi': { category: 'Lebensmittel', confidence: 0.95 },
  'edeka': { category: 'Lebensmittel', confidence: 0.95 },
  'lidl': { category: 'Lebensmittel', confidence: 0.95 },
  'penny': { category: 'Lebensmittel', confidence: 0.95 },
  'netto': { category: 'Lebensmittel', confidence: 0.95 },
  'supermarkt': { category: 'Lebensmittel', confidence: 0.90 },
  'lebensmittel': { category: 'Lebensmittel', confidence: 0.90 },
  
  // Transport
  'tankstelle': { category: 'Benzin', confidence: 0.95 },
  'shell': { category: 'Benzin', confidence: 0.95 },
  'esso': { category: 'Benzin', confidence: 0.95 },
  'aral': { category: 'Benzin', confidence: 0.95 },
  'taxi': { category: 'Taxi & Rideshare', confidence: 0.95 },
  'uber': { category: 'Taxi & Rideshare', confidence: 0.95 },
  'bahn': { category: 'Öffentliche Verkehrsmittel', confidence: 0.90 },
  'bus': { category: 'Öffentliche Verkehrsmittel', confidence: 0.90 },
  'voi': { category: 'Transport', confidence: 0.80 }, // E-Scooter aus Vivid PDF
  
  // Gesundheit
  'apotheke': { category: 'Apotheke', confidence: 0.95 },
  'pharmacy': { category: 'Apotheke', confidence: 0.95 },
  'krankenkasse': { category: 'Krankenversicherung', confidence: 0.95 },
  'techniker': { category: 'Krankenversicherung', confidence: 0.90 },
  'tk': { category: 'Krankenversicherung', confidence: 0.90 },
  'aok': { category: 'Krankenversicherung', confidence: 0.90 },
  
  // Entertainment
  'netflix': { category: 'Streaming', confidence: 0.95 },
  'spotify': { category: 'Streaming', confidence: 0.95 },
  'amazon prime': { category: 'Streaming', confidence: 0.95 },
  'fitness': { category: 'Sport & Fitness', confidence: 0.90 },
  'benefit': { category: 'Sport & Fitness', confidence: 0.85 }, // Aus Vivid PDF
  'kino': { category: 'Entertainment', confidence: 0.90 },
  
  // Restaurants
  'restaurant': { category: 'Restaurants', confidence: 0.90 },
  'café': { category: 'Restaurants', confidence: 0.85 },
  'mcdonald': { category: 'Restaurants', confidence: 0.90 },
  'burger king': { category: 'Restaurants', confidence: 0.90 },
  
  // Shopping
  'amazon': { category: 'Shopping', confidence: 0.80 },
  'paypal': { category: 'Shopping', confidence: 0.70 },
  'zalando': { category: 'Shopping', confidence: 0.90 },
  'otto': { category: 'Shopping', confidence: 0.85 },
  
  // Verschiedenes
  'hundesteuer': { category: 'Steuern & Abgaben', confidence: 0.95 }, // Aus Vivid PDF
  'steuer': { category: 'Steuern & Abgaben', confidence: 0.90 },
  'riverty': { category: 'Shopping', confidence: 0.75 } // Amazon-Zahlungsabwickler aus PDF
};

// Hauptfunktion: Standardkategorien initialisieren
export async function initializeDefaultCategories() {
  try {
    const existingCount = await db.categories.count();
    if (existingCount > 0) {
      console.log('Kategorien bereits vorhanden');
      return false;
    }
    
    console.log('Initialisiere Standardkategorien...');
    
    // Erst Hauptkategorien erstellen
    const categoryMap = new Map();
    
    for (const cat of defaultCategories) {
      if (cat.parentId === null) {
        const id = await db.categories.add({
          name: cat.name,
          parentId: null
        });
        categoryMap.set(cat.name, id);
      }
    }
    
    // Dann Unterkategorien
    for (const cat of defaultCategories) {
      if (cat.parentId !== null) {
        const parentId = categoryMap.get(cat.parentId);
        if (parentId) {
          await db.categories.add({
            name: cat.name,
            parentId: parentId
          });
        }
      }
    }
    
    console.log(`${defaultCategories.length} Standardkategorien erstellt`);
    return true;
    
  } catch (error) {
    console.error('Fehler beim Initialisieren der Kategorien:', error);
    throw error;
  }
}

// Hauptfunktion: Smarte Kategorievorschläge
export async function suggestCategoryForTransaction(description, recipient, amount) {
  const searchText = `${description} ${recipient}`.toLowerCase();
  const suggestions = [];
  
  // Durchsuche alle Mappings
  for (const [keyword, mapping] of Object.entries(smartCategoryMappings)) {
    if (searchText.includes(keyword)) {
      try {
        const category = await db.categories.where('name').equals(mapping.category).first();
        if (category) {
          suggestions.push({
            category: category,
            confidence: mapping.confidence,
            reason: `Keyword "${keyword}" gefunden`,
            matchedKeyword: keyword
          });
        }
      } catch (error) {
        console.warn(`Kategorie "${mapping.category}" nicht gefunden`);
      }
    }
  }
  
  // Sortiere nach Konfidenz (höchste zuerst)
  suggestions.sort((a, b) => b.confidence - a.confidence);
  
  // Rückgabe der besten Vorschläge (max 3)
  return suggestions.slice(0, 3);
}

// Hilfsfunktion: Alle Kategorien mit Hierarchie laden
export async function getCategoriesWithHierarchy() {
  try {
    const allCategories = await db.categories.toArray();
    
    // Erstelle Hierarchie-Struktur
    const categoryTree = [];
    const categoryMap = new Map();
    
    // Erste Durchgang: Alle Kategorien indexieren
    allCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    // Zweiter Durchgang: Hierarchie aufbauen
    allCategories.forEach(cat => {
      if (cat.parentId === null) {
        categoryTree.push(categoryMap.get(cat.id));
      } else {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      }
    });
    
    return categoryTree;
  } catch (error) {
    console.error('Fehler beim Laden der Kategorien:', error);
    return [];
  }
}

// Hilfsfunktion: Statistiken über Kategorienverwendung
export async function getCategoryUsageStats() {
  try {
    const transactions = await db.transactions.toArray();
    const stats = {};
    
    transactions.forEach(tx => {
      if (tx.category) {
        stats[tx.category] = (stats[tx.category] || 0) + 1;
      }
    });
    
    // Sortiere nach Häufigkeit
    return Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .map(([category, count]) => ({ category, count }));
      
  } catch (error) {
    console.error('Fehler beim Laden der Kategorie-Statistiken:', error);
    return [];
  }
}