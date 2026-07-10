import {
  Chart,
  ArcElement,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(
  ArcElement,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

// Categories are user-defined (see stores/categories.js) and each carries its own hex
// color, so chart slices use that directly. This is only the color for the synthetic
// "Other" slice that foldCategories() creates for long tails, and the fallback if a
// category somehow has no color on record.
export const OTHER_SLICE_COLOR = { light: '#64748b', dark: '#94a3b8' };

// Semantic series colors (income/positive vs expense/negative)
export const SERIES = {
  light: {
    brand: '#0f766e',
    brandSoft: 'rgba(15, 118, 110, 0.12)',
    income: '#1baf7a',
    expense: '#e34948',
    budget: '#2a78d6',
  },
  dark: {
    brand: '#3db29a',
    brandSoft: 'rgba(61, 178, 154, 0.15)',
    income: '#199e70',
    expense: '#e66767',
    budget: '#3987e5',
  },
};

export function chartInk(dark) {
  return {
    ink: dark ? '#e2e8f0' : '#334155',
    muted: dark ? '#94a3b8' : '#64748b',
    grid: dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.12)',
    surface: dark ? '#0f172a' : '#ffffff',
  };
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' });

export function baseOptions(dark, { money = true, legend = false } = {}) {
  const { ink, muted, grid } = chartInk(dark);
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: legend
        ? {
            position: 'bottom',
            labels: { color: ink, usePointStyle: true, pointStyleWidth: 10, boxHeight: 6, padding: 16 },
          }
        : { display: false },
      tooltip: {
        backgroundColor: dark ? '#1e293b' : '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        callbacks: money
          ? {
              label: (ctx) =>
                `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${moneyFmt.format(ctx.parsed.y ?? ctx.parsed)}`,
            }
          : {},
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: muted, font: { size: 11 } },
        border: { color: grid },
      },
      y: {
        grid: { color: grid },
        ticks: {
          color: muted,
          font: { size: 11 },
          callback: (v) => (money ? moneyFmt.format(v).replace('.00', '') : v),
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };
}

// Doughnuts have no scales; slice gaps are the CVD relief
export function doughnutOptions(dark) {
  const opts = baseOptions(dark, { money: true, legend: true });
  delete opts.scales;
  opts.plugins.tooltip.callbacks = {
    label: (ctx) => `${ctx.label}: ${moneyFmt.format(ctx.parsed)}`,
  };
  opts.cutout = '62%';
  return opts;
}

// Fold categories beyond the top N into "Other" so slices stay readable
export function foldCategories(byCategory, maxSlices = 7) {
  if (byCategory.length <= maxSlices + 1) return byCategory;
  const top = byCategory.slice(0, maxSlices);
  const rest = byCategory.slice(maxSlices).reduce((sum, c) => sum + c.amount, 0);
  const other = top.find((c) => c.category === 'Other');
  if (other) {
    return [...top.filter((c) => c !== other), { category: 'Other', amount: other.amount + rest }];
  }
  return [...top, { category: 'Other', amount: Math.round(rest * 100) / 100 }];
}
