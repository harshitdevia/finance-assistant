// Single source of truth for transaction/budget categories used across the app.
// Previously each page (Transactions, Dashboard, Budgets, OnboardingWizard) kept
// its own hardcoded list with inconsistent spellings (e.g. "Health" vs "Healthcare"),
// which meant a budget created under one spelling would never match transactions
// logged under another. Import from here instead of redefining a local list.

export const INCOME_CATEGORIES = ['Salary', 'Freelance'];

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Utilities',
  'Rent',
  'Education',
  'Travel',
  'Insurance',
  'Savings',
  'Others'
];

export const CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const CATEGORY_COLORS = {
  Salary: '#22c55e',
  Freelance: '#0ea5e9',
  Food: '#f59e0b',
  Groceries: '#84cc16',
  Transport: '#3b82f6',
  Shopping: '#ec4899',
  Entertainment: '#8b5cf6',
  Health: '#f43f5e',
  Utilities: '#6366f1',
  Rent: '#ef4444',
  Education: '#a855f7',
  Travel: '#f97316',
  Insurance: '#06b6d4',
  Savings: '#22c55e',
  Others: '#6b7280'
};
