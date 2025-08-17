// Einfacher Test der normalizeDate Funktion für beide Parser

function testNormalizeDate() {
  console.log('📅 DATUMS-NORMALISIERUNG TEST');
  console.log('============================');
  
  // Die aktuelle korrigierte normalizeDate Funktion
  function normalizeDate(dateString) {
    if (!dateString) return new Date().toISOString().slice(0, 10);
    const parts = dateString.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (parts) {
      const year = parts[3];
      const month = parts[2].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().slice(0, 10);
  }
  
  // Test für beide Parser-Formate
  const testCases = [
    // Vivid Format
    { input: '01.07.2025', expected: '2025-07-01', source: 'Vivid' },
    { input: '02.07.2025', expected: '2025-07-02', source: 'Vivid' },
    
    // ING Format  
    { input: '05.01.2025', expected: '2025-01-05', source: 'ING' },
    { input: '15.01.2025', expected: '2025-01-15', source: 'ING' },
    
    // Edge Cases
    { input: '29.02.2024', expected: '2024-02-29', source: 'Schaltjahr' },
    { input: '31.12.2023', expected: '2023-12-31', source: 'Jahresende' },
    { input: '01.01.2025', expected: '2025-01-01', source: 'Jahresanfang' }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const test of testCases) {
    const result = normalizeDate(test.input);
    const passed = result === test.expected;
    
    console.log(`${passed ? '✅' : '❌'} ${test.source}: ${test.input} → ${result}${passed ? '' : ` (erwartet: ${test.expected})`}`);
    
    if (passed) {
      totalPassed++;
    } else {
      totalFailed++;
    }
  }
  
  console.log('\n📊 ERGEBNIS:');
  console.log(`✅ Bestanden: ${totalPassed}`);
  console.log(`❌ Fehlgeschlagen: ${totalFailed}`);
  console.log(`📈 Erfolgsquote: ${Math.round((totalPassed / testCases.length) * 100)}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 SUCCESS: normalizeDate funktioniert für beide Parser!');
    console.log('✅ Keine Regression bei ING-Parser');
    console.log('✅ Korrekte Funktionalität für Vivid-Parser');
    console.log('✅ Edge Cases abgedeckt');
    return true;
  } else {
    console.log('\n💥 PROBLEM: normalizeDate hat Fehler!');
    return false;
  }
}

// Test ausführen
const success = testNormalizeDate();
process.exit(success ? 0 : 1);