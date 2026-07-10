import { Router } from 'express';
import { z } from 'zod';
import * as expenseController from '../controllers/expenseController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { CATEGORIES, PAYMENT_METHODS } from '../utils/constants.js';

const router = Router();
router.use(requireAuth);

const expenseBody = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.enum(CATEGORIES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().max(1000).nullable().optional(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const filterQuery = z.object({
  search: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

const listQuery = filterQuery.extend({
  sortBy: z.enum(['date', 'amount', 'title', 'category', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const exportQuery = filterQuery.extend({
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

router.get('/', validate({ query: listQuery }), expenseController.list);
router.get('/export', validate({ query: exportQuery }), expenseController.exportExpenses);
router.get('/:id', expenseController.get);
router.post('/', validate({ body: expenseBody }), expenseController.create);
router.put('/:id', validate({ body: expenseBody.partial() }), expenseController.update);
router.delete('/:id', expenseController.remove);
router.post('/:id/duplicate', expenseController.duplicate);

export default router;
