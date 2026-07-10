import { Router } from 'express';
import { z } from 'zod';
import * as budgetController from '../controllers/budgetController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { CATEGORIES } from '../utils/constants.js';

const router = Router();
router.use(requireAuth);

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');

const budgetBody = z.object({
  category: z.enum(CATEGORIES).nullable().optional(),
  limit: z.number().positive(),
  month: monthSchema,
});

router.get('/', validate({ query: z.object({ month: monthSchema.optional() }) }), budgetController.list);
router.post('/', validate({ body: budgetBody }), budgetController.create);
router.put(
  '/:id',
  validate({ body: budgetBody.partial() }),
  budgetController.update,
);
router.delete('/:id', budgetController.remove);

export default router;
