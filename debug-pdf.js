// Debug script to analyze PayPal transactions in the PDF
const { BankStatementParser } = require('./app/utils/pdfParser.js');

console.log("🔍 Debugging PayPal transaction extraction from Kontoauszug_20250802.pdf\n");

// Since we can't directly parse PDF in this environment, 
// let's create a test with the most likely PayPal transaction formats from German ING bank statements

const likelyPayPalFormats = [
  `29.07.2024  Lastschrift PayPal Europe S.a.r.l. et Cie S.C.A
  Mandat: M-XXXXXXXXX, Referenz: XXXXXXXXX
  PP.1234567890.PP / Uber, Ihr Einkauf bei Uber  -109,88 EUR`,
  
  `22.07.2024  Lastschrift PayPal Europe S.a.r.l. et Cie S.C.A
  Referenz: 1234567890PP
  Verwendungszweck: Lieferando  -45,67 EUR`,
  
  `15.07.2024  Lastschrift PayPal Europe S.a.r.l. et Cie S.C.A
  1234567890/. Amazon, Ihr Einkauf bei Amazon  -89,99 EUR`,
  
  `08.07.2024  Lastschrift PayPal (Europe) S.à r.l. et Cie, S.C.A.
  Referenz: PP123456789
  Netflix Premium  -12,99 EUR`
];

console.log("📋 Testing with likely PayPal transaction formats:\n");

likelyPayPalFormats.forEach((transaction, index) => {
  console.log(`Transaction ${index + 1}:`);
  console.log(transaction);
  console.log("Raw text (what parser sees):");
  const rawText = transaction.replace(/\s+/g, ' ').trim();
  console.log(`"${rawText}"\n`);
  
  // Test current extraction patterns
  const paypalMatch = rawText.match(/PayPal Europe S\.a\.r\.l\. et Cie S\.C\.A/i);
  if (paypalMatch) {
    console.log("✅ PayPal detected");
    
    // Test merchant extraction patterns
    const patterns = [
      /PP\.\d+\.PP\s*\/\s*([^,]+),?\s*Ihr Einkauf bei/i,
      /Verwendungszweck:\s*([^\d\-]+?)(?:\s*-|\s*$)/i,
      /\d{10,}\s*\/\.\s*([^,]+),?\s*Ihr Einkauf bei/i,
      /Referenz:.*?([A-Za-z][A-Za-z\s]{2,})(?:\s*-|\s*$)/i
    ];
    
    patterns.forEach((pattern, i) => {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        console.log(`  Pattern ${i+1}: "${match[1].trim()}"`);
      }
    });
  }
  console.log("---\n");
});

console.log("💡 Recommendation: Need to see actual PDF text extraction to fix patterns accurately");