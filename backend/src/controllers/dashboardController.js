import * as statsService from '../services/statsService.js';

export async function dashboard(req, res, next) {
  try {
    res.json(await statsService.getDashboard(req.user.id, req.validatedQuery?.month));
  } catch (err) {
    next(err);
  }
}

export async function analytics(req, res, next) {
  try {
    res.json(await statsService.getAnalytics(req.user.id, req.validatedQuery));
  } catch (err) {
    next(err);
  }
}
