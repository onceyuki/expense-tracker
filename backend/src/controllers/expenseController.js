import * as expenseService from '../services/expenseService.js';
import { toCSV, toExcel } from '../utils/exporters.js';

const EXPORT_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'title', header: 'Title' },
  { key: 'category', header: 'Category' },
  { key: 'amount', header: 'Amount' },
  { key: 'wallet', header: 'Wallet' },
  { key: 'notes', header: 'Notes' },
];

export async function list(req, res, next) {
  try {
    res.json(await expenseService.listExpenses(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    res.json({ expense: await expenseService.getExpense(req.user.id, req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const expense = await expenseService.createExpense(req.user.id, req.body);
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const expense = await expenseService.updateExpense(req.user.id, req.params.id, req.body);
    res.json({ expense });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await expenseService.deleteExpense(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function duplicate(req, res, next) {
  try {
    const expense = await expenseService.duplicateExpense(req.user.id, req.params.id);
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
}

export async function exportExpenses(req, res, next) {
  try {
    const { format, ...filters } = req.validatedQuery;
    const rows = await expenseService.listAllForExport(req.user.id, filters);
    const data = rows.map((e) => ({
      ...e,
      wallet: e.wallet?.name ?? '',
      date: e.date.toISOString().slice(0, 10),
    }));
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'xlsx') {
      const buffer = await toExcel(data, EXPORT_COLUMNS, 'Expenses');
      res
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .set('Content-Disposition', `attachment; filename="expenses-${stamp}.xlsx"`)
        .send(buffer);
    } else {
      res
        .type('text/csv')
        .set('Content-Disposition', `attachment; filename="expenses-${stamp}.csv"`)
        .send(toCSV(data, EXPORT_COLUMNS));
    }
  } catch (err) {
    next(err);
  }
}
