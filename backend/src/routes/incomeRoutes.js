import { Router } from 'express';
import { z } from 'zod';
import * as incomeController from '../controllers/incomeController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const incomeBody = z.object({
  source: z.string().min(1).max(200),
  amount: z.number().positive(),
  walletId: z.string().min(1).nullable().optional(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().max(1000).nullable().optional(),
});

const listQuery = z.object({
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['date', 'amount', 'source', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

router.get('/', validate({ query: listQuery }), incomeController.list);
router.post('/', validate({ body: incomeBody }), incomeController.create);
router.put('/:id', validate({ body: incomeBody.partial() }), incomeController.update);
router.delete('/:id', incomeController.remove);

export default router;
