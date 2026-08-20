import { Router } from 'express';
import { z } from 'zod';
import * as savingsController from '../controllers/savingsController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const goalBody = z.object({
  name: z.string().trim().min(1).max(60),
  target: z.number().positive().nullable().optional(),
});

const contributionBody = z.object({
  amount: z.number().positive(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().max(1000).nullable().optional(),
});

router.get('/', savingsController.list);
router.post('/', validate({ body: goalBody }), savingsController.create);
router.put('/:id', validate({ body: goalBody.partial() }), savingsController.update);
router.delete('/:id', savingsController.remove);
router.post('/:id/contributions', validate({ body: contributionBody }), savingsController.addContribution);
router.delete('/:id/contributions/:cid', savingsController.removeContribution);

export default router;
