import * as categoryService from '../services/categoryService.js';

export async function list(req, res, next) {
  try {
    res.json({ categories: await categoryService.listCategories(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const category = await categoryService.createCategory(req.user.id, req.body);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const category = await categoryService.updateCategory(req.user.id, req.params.id, req.body);
    res.json({ category });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await categoryService.deleteCategory(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
