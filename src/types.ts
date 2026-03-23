export interface Installment {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  receipt_url?: string;
}

export interface Card {
  id: string;
  user_id: string;
  name: string;
  last_digits: string;
  color: string;
  created_at: string;
  receipt_url?: string;
}

export interface FixedExpense {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  due_day: number;
  category: string;
  created_at: string;
  receipt_url?: string;
}

export interface Debt {
  id: string;
  user_id: string;
  title: string;
  total_amount: number;
  category: 'personal' | 'installment' | 'fixed' | 'other';
  person_name?: string;
  card_id?: string;
  installments: Installment[];
  created_at: string;
  notes?: string;
  isShared?: boolean;
}

export interface UserProfile {
  user_id: string;
  monthly_income: number;
  updated_at: string;
}
