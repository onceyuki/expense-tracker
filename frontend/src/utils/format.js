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

// Categories are now user-defined (see stores/categories.js), each with its own hex
// color, so chip styling can't be a static Tailwind class map keyed by name anymore —
// this builds a tinted background/solid-text style directly from that hex value.
export function categoryChipStyle(color) {
  const hex = color ?? '#64748b';
  return { backgroundColor: `${hex}26`, color: hex };
}
