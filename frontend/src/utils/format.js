const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'PHP',
});

export function formatMoney(value) {
  return currencyFmt.format(value ?? 0);
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// For <input type="date"> values
export function toDateInput(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CATEGORIES = [
  // 'Food', 'Transportation', 'Shopping', 'Utilities', 'Rent',
  // 'Entertainment', 'Health', 'Education', 'Bills', 'Travel', 'Other',
  'Wants', 'Needs', 'Savings'
];

export const PAYMENT_METHODS = [
  'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Mobile Payment', 'Other',
];

// Tinted chip styles per category (light + dark)
export const CATEGORY_STYLES = {
  Wants: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Needs: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  Savings: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  Transportation: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  Shopping: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  Utilities: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300',
  Rent: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  Entertainment: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  Health: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  Education: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  Bills: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  Travel: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  Other: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
};
