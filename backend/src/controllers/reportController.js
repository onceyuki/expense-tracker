import * as statsService from '../services/statsService.js';
import { toCSV, toExcel } from '../utils/exporters.js';
import { buildPdf } from '../utils/pdf.js';
import { monthKey } from '../services/statsService.js';

const money = (n) => (typeof n === 'number' ? n.toFixed(2) : n);

async function sendReport(res, { format, filename, title, summaryLines, columns, rows }) {
  if (format === 'csv') {
    return res
      .type('text/csv')
      .set('Content-Disposition', `attachment; filename="${filename}.csv"`)
      .send(toCSV(rows, columns));
  }
  if (format === 'xlsx') {
    const buffer = await toExcel(rows, columns, title);
    return res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .set('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
      .send(buffer);
  }
  if (format === 'pdf') {
    const buffer = await buildPdf(title, [
      { heading: 'Summary', lines: summaryLines },
      { heading: 'Details', table: { columns, rows } },
    ]);
    return res
      .type('application/pdf')
      .set('Content-Disposition', `attachment; filename="${filename}.pdf"`)
      .send(buffer);
  }
  return null;
}

export async function monthly(req, res, next) {
  try {
    const { format = 'json' } = req.validatedQuery;
    const month = req.validatedQuery.month ?? monthKey(new Date());
    const report = await statsService.getMonthlyReport(req.user.id, month);
    if (format === 'json') return res.json(report);

    await sendReport(res, {
      format,
      filename: `monthly-report-${month}`,
      title: `Monthly Report ${month}`,
      summaryLines: [
        `Income: ${money(report.income)}`,
        `Expenses: ${money(report.expenses)}`,
        `Savings: ${money(report.savings)} (${report.savingsRate}%)`,
      ],
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'title', header: 'Title' },
        { key: 'category', header: 'Category' },
        { key: 'amount', header: 'Amount' },
        { key: 'wallet', header: 'Wallet' },
      ],
      rows: report.transactions.map((t) => ({
        ...t,
        wallet: t.wallet?.name ?? '',
        date: t.date.toISOString().slice(0, 10),
        amount: money(t.amount),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function yearly(req, res, next) {
  try {
    const { format = 'json' } = req.validatedQuery;
    const year = req.validatedQuery.year ?? String(new Date().getFullYear());
    const report = await statsService.getYearlyReport(req.user.id, year);
    if (format === 'json') return res.json(report);

    await sendReport(res, {
      format,
      filename: `yearly-report-${year}`,
      title: `Yearly Report ${year}`,
      summaryLines: [
        `Income: ${money(report.totals.income)}`,
        `Expenses: ${money(report.totals.expenses)}`,
        `Net: ${money(report.totals.net)}`,
      ],
      columns: [
        { key: 'month', header: 'Month' },
        { key: 'income', header: 'Income' },
        { key: 'expenses', header: 'Expenses' },
        { key: 'net', header: 'Net' },
      ],
      rows: report.months.map((m) => ({
        ...m,
        income: money(m.income),
        expenses: money(m.expenses),
        net: money(m.net),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function categories(req, res, next) {
  try {
    const { format = 'json', from, to } = req.validatedQuery;
    const report = await statsService.getCategoryReport(req.user.id, { from, to });
    if (format === 'json') return res.json(report);

    await sendReport(res, {
      format,
      filename: 'category-report',
      title: 'Category Report',
      summaryLines: [`Total spending: ${money(report.total)}`],
      columns: [
        { key: 'category', header: 'Category' },
        { key: 'amount', header: 'Amount' },
        { key: 'count', header: 'Transactions' },
        { key: 'percent', header: 'Percent' },
      ],
      rows: report.categories.map((c) => ({ ...c, amount: money(c.amount), percent: `${c.percent}%` })),
    });
  } catch (err) {
    next(err);
  }
}
