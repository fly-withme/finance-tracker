// Dieser Typ repräsentiert eine fertige Transaktion, wie sie in der DB liegt
export type Transaction = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category?: string;
  created_at: string;
};

// NEU: Dieser Typ repräsentiert die Rohdaten, die aus dem OCR-Scan kommen
export type ParsedTransaction = {
  name: string;
  amount: number;
};