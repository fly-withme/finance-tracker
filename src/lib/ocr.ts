import { createWorker } from 'tesseract.js';
import type { Transaction } from './types';

export async function processImageWithOCR(file: File): Promise<{ needsReview: Transaction[] }> {
  console.log('Starting real OCR process...');

  const worker = await createWorker('deu');
  const ret = await worker.recognize(file);
  const text = ret.data.text;
  console.log('Recognized text:\n', text);

  await worker.terminate();
  console.log('OCR process finished.');

  return parseTransactionsFromText(text);
}

// NEUE, VERBESSERTE PARSER-LOGIK
function parseTransactionsFromText(text: string): { needsReview: Transaction[] } {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const transactions: Transaction[] = [];

  // Regex, die einen Geldbetrag irgendwo in der Zeile findet
  const amountRegex = /([+-]?\s?\d{1,3}(?:\.\d{3})*,\d{2})\s?€?/;

  lines.forEach(line => {
    const match = line.match(amountRegex);

    if (match && match[1]) {
      // Wir haben einen Betrag gefunden
      const amountString = match[1].replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(amountString);

      // Alles in der Zeile vor dem Betrag ist die Beschreibung
      const name = line.substring(0, match.index).trim();

      if (!isNaN(amount) && name) {
        transactions.push({
          id: `tx_${Math.random()}`,
          name: name,
          amount: amount,
        });
      }
    }
  });

  console.log('Parsed transactions:', transactions);
  return { needsReview: transactions };
}