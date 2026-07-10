import * as incomeService from '../services/incomeService.js';

export async function list(req, res, next) {
  try {
    res.json(await incomeService.listIncome(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const income = await incomeService.createIncome(req.user.id, req.body);
    res.status(201).json({ income });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const income = await incomeService.updateIncome(req.user.id, req.params.id, req.body);
    res.json({ income });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await incomeService.deleteIncome(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
