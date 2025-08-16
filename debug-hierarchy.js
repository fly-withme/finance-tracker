// Debug-Script für Kategorie-Hierarchie
// Führe das in der Browser-Konsole auf localhost:3001 aus

async function debugCategoryHierarchy() {
  console.log('🔍 Starting Category Hierarchy Debug...');
  
  try {
    // Zugriff auf die globale db-Instanz
    const { db } = window;
    
    if (!db) {
      console.error('❌ Database not found! Make sure you are on the correct page.');
      return;
    }
    
    console.log('✅ Database found');
    console.log('📊 Database version:', db.verno);
    
    // Alle Kategorien abrufen
    const allCategories = await db.categories.toArray();
    console.log('📋 All categories:', allCategories);
    console.log('📈 Total categories:', allCategories.length);
    
    // Kategorien nach parentId filtern
    const mainCategories = allCategories.filter(cat => !cat.parentId);
    const subCategories = allCategories.filter(cat => cat.parentId);
    
    console.log('🏠 Main categories:', mainCategories);
    console.log('🏢 Sub categories:', subCategories);
    
    // Test: Erstelle Unterkategorie falls keine vorhanden
    if (subCategories.length === 0 && mainCategories.length > 0) {
      console.log('🧪 Creating test subcategory...');
      
      const parentCategory = mainCategories[0];
      const testSubcategory = {
        name: `${parentCategory.name} - Test Sub`,
        color: '#10B981',
        parentId: parentCategory.id
      };
      
      console.log('➕ Adding subcategory:', testSubcategory);
      const subcategoryId = await db.categories.add(testSubcategory);
      console.log('✅ Subcategory created with ID:', subcategoryId);
      
      // Alle Kategorien erneut abrufen
      const updatedCategories = await db.categories.toArray();
      const updatedSubs = updatedCategories.filter(cat => cat.parentId);
      console.log('🔄 Updated subcategories:', updatedSubs);
      
      if (updatedSubs.length > 0) {
        console.log('✅ SUCCESS: Subcategory successfully created!');
        console.log('👁️  You should now see the indented subcategory in the UI');
      }
    } else if (subCategories.length > 0) {
      console.log('✅ SUCCESS: Subcategories already exist!');
      console.log('👁️  Check if they are displayed as indented in the UI');
    } else {
      console.log('⚠️  No main categories found. Create a main category first.');
    }
    
    // Hierarchie-Struktur anzeigen
    console.log('🌳 Hierarchy Structure:');
    mainCategories.forEach(mainCat => {
      console.log(`├── ${mainCat.name} (ID: ${mainCat.id})`);
      const subs = allCategories.filter(cat => cat.parentId === mainCat.id);
      subs.forEach((sub, index) => {
        const isLast = index === subs.length - 1;
        console.log(`${isLast ? '└──' : '├──'}     ${sub.name} (ID: ${sub.id}, Parent: ${sub.parentId})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

// Script ausführen
debugCategoryHierarchy();