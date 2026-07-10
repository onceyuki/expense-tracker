// Seeded onto every new user's account at registration; after that, categories
// are fully user-managed via /api/categories (see categoryService.js).
export const DEFAULT_CATEGORIES = [
  { name: 'Wants', color: '#eda100' },
  { name: 'Needs', color: '#2a78d6' },
  { name: 'Savings', color: '#1baf7a' },
];

// Cycled through when a user creates a category without picking a color.
export const CATEGORY_COLOR_PALETTE = [
  '#eda100', '#2a78d6', '#1baf7a', '#e87ba4', '#4a3aa7', '#eb6834',
  '#e34948', '#008300', '#0891b2', '#4d7c0f', '#9333ea', '#64748b',
];

export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Mobile Payment',
  'Other',
];
