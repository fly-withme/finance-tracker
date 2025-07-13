export type Transaction = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category?: string;
  created_at: string;
};