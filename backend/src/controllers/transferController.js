import * as transferService from '../services/transferService.js';

export async function list(req, res, next) {
  try {
    res.json(await transferService.listTransfers(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const transfer = await transferService.createTransfer(req.user.id, req.body);
    res.status(201).json({ transfer });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const transfer = await transferService.updateTransfer(req.user.id, req.params.id, req.body);
    res.json({ transfer });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await transferService.deleteTransfer(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
