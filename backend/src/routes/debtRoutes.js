import { Router } from 'express';
import { z } from 'zod';
import * as debtController from '../controllers/debtController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const debtBody = z.object({
  person: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  paid: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

router.get('/', validate({ query: listQuery }), debtController.list);
router.post('/', validate({ body: debtBody }), debtController.create);
router.put('/:id', validate({ body: debtBody.partial() }), debtController.update);
router.delete('/:id', debtController.remove);

export default router;
