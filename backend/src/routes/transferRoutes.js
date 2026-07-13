import { Router } from 'express';
import { z } from 'zod';
import * as transferController from '../controllers/transferController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const transferBody = z.object({
  fromWalletId: z.string().min(1),
  toWalletId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().max(1000).nullable().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

router.get('/', validate({ query: listQuery }), transferController.list);
router.post('/', validate({ body: transferBody }), transferController.create);
router.put('/:id', validate({ body: transferBody.partial() }), transferController.update);
router.delete('/:id', transferController.remove);

export default router;
