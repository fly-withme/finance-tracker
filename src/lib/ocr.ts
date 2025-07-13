import { createWorker } from 'tesseract.js';
import type { ParsedTransaction } from './types'; // NEU: Importiert den neuen Typ

export async function processImageWithOCR(file: File): Promise<{ needsReview: ParsedTransaction[] }> {
  console.log('Starting real OCR process...');

  const worker = await createWorker('deu');
  const ret = await worker.recognize(file);
  const text = ret.data.text;
  console.log('Recognized text:\n', text);

  await worker.terminate();
  console.log('OCR process finished.');

  return parseTransactionsFromText(text);
}

function parseTransactionsFromText(text: string): { needsReview: ParsedTransaction[] } {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const transactions: ParsedTransaction[] = []; // Verwendet den neuen Typ

  const amountRegex = /([+-]?\s?\d{1,3}(?:\.\d{3})*,\d{2})\s?€?/;

  lines.forEach(line => {
    const match = line.match(amountRegex);
    if (match && match[1]) {
      const amountString = match[1].replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(amountString);
      const name = line.substring(0, match.index).trim();
      if (!isNaN(amount) && name) {
        transactions.push({ name: name, amount: amount });
      }
    }
  });

  console.log('Parsed transactions:', transactions);
  return { needsReview: transactions };
}