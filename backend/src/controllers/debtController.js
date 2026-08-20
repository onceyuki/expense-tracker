import * as debtService from '../services/debtService.js';

export async function list(req, res, next) {
  try {
    res.json(await debtService.listDebts(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const debt = await debtService.createDebt(req.user.id, req.body);
    res.status(201).json({ debt });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const debt = await debtService.updateDebt(req.user.id, req.params.id, req.body);
    res.json({ debt });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await debtService.deleteDebt(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
