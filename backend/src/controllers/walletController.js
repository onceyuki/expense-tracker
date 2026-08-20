import * as walletService from '../services/walletService.js';

export async function list(req, res, next) {
  try {
    res.json({ wallets: await walletService.listWallets(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const wallet = await walletService.createWallet(req.user.id, req.body);
    res.status(201).json({ wallet });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const wallet = await walletService.updateWallet(req.user.id, req.params.id, req.body);
    res.json({ wallet });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await walletService.deleteWallet(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
