import * as savingsService from '../services/savingsService.js';

export async function list(req, res, next) {
  try {
    res.json({ goals: await savingsService.listGoals(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const goal = await savingsService.createGoal(req.user.id, req.body);
    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const goal = await savingsService.updateGoal(req.user.id, req.params.id, req.body);
    res.json({ goal });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await savingsService.deleteGoal(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function addContribution(req, res, next) {
  try {
    const contribution = await savingsService.addContribution(req.user.id, req.params.id, req.body);
    res.status(201).json({ contribution });
  } catch (err) {
    next(err);
  }
}

export async function removeContribution(req, res, next) {
  try {
    await savingsService.removeContribution(req.user.id, req.params.id, req.params.cid);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
