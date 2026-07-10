import * as budgetService from '../services/budgetService.js';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function list(req, res, next) {
  try {
    const month = req.validatedQuery.month ?? currentMonth();
    res.json({ month, budgets: await budgetService.listBudgets(req.user.id, month) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const budget = await budgetService.createBudget(req.user.id, req.body);
    res.status(201).json({ budget });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const budget = await budgetService.updateBudget(req.user.id, req.params.id, req.body);
    res.json({ budget });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await budgetService.deleteBudget(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
