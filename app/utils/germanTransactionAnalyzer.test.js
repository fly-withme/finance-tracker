import { germanTransactionAnalyzer } from './germanTransactionAnalyzer.js';

// Test cases from the German prompt
const testTransactions = [
  {
    input: "Ueberweisung Stichting Pay.nl, Kennzeichen: 12345, Verwendungszweck: Ihre Bestellung bei Bol.com",
    expected: { recipient: "Bol.com", payment_processor: "Stichting Pay.nl", confidence: 0.95 }
  },
  {
    input: "Lastschrift PayPal Europe S.a.r.l. et Cie S.C.A, Referenz: 98765, Verwendungszweck: Lieferando",
    expected: { recipient: "Lieferando", payment_processor: "PayPal", confidence: 0.95 }
  },
  {
    input: "Lastschrift PayPal Europe S.a.r.l. et Cie S.C.A 1043644529546/. Uber, Ihr Einkauf bei Uber",
    expected: { recipient: "Uber", payment_processor: "PayPal", confidence: 0.98 }
  },
  {
    input: "Einkauf vom 29.07. bei REWE Markt GmbH",
    expected: { recipient: "REWE Markt GmbH", payment_processor: null, confidence: 1.0 }
  },
  {
    input: "Ueberweisung Stichting Pay.nl, REF: XYZ-54321",
    expected: { recipient: "Stichting Pay.nl", payment_processor: "Stichting Pay.nl", confidence: 0.6 }
  }
];

console.log("🧪 Testing German Transaction Analyzer\n");

testTransactions.forEach((test, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`Input: "${test.input}"`);
  
  const result = germanTransactionAnalyzer.analyzeTransaction(test.input);
  
  console.log(`Result: ${JSON.stringify(result)}`);
  console.log(`Expected: ${JSON.stringify(test.expected)}`);
  
  // Check if results match expectations
  const recipientMatch = result.recipient === test.expected.recipient;
  const processorMatch = result.payment_processor === test.expected.payment_processor;
  const confidenceClose = Math.abs(result.confidence - test.expected.confidence) <= 0.1;
  
  const success = recipientMatch && processorMatch && confidenceClose;
  console.log(`✅ ${success ? 'PASS' : 'FAIL'} - ${recipientMatch ? '✓' : '✗'} Recipient, ${processorMatch ? '✓' : '✗'} Processor, ${confidenceClose ? '✓' : '✗'} Confidence\n`);
});

// Additional real-world examples
console.log("🌍 Additional Real-World Examples:\n");

const additionalTests = [
  "Lastschrift PayPal (Europe) S.à r.l. et Cie, S.C.A. 1PA12345678901 Amazon.de Marketplace",
  "Ueberweisung Klarna AB, Referenz: KLR-789, bei Zalando SE",
  "GIROCARD 12.08. 15:23 LIDL SAGT DANKE//MUENCHEN/DE",
  "Lastschrift Mollie Payments B.V., Verwendungszweck: Spotify Premium"
];

additionalTests.forEach((transaction, index) => {
  console.log(`Additional Test ${index + 1}:`);
  console.log(`Input: "${transaction}"`);
  
  const result = germanTransactionAnalyzer.analyzeTransaction(transaction);
  console.log(`Result: ${JSON.stringify(result, null, 2)}\n`);
});

console.log("📊 Test Summary Complete");