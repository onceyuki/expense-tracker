import { Router } from 'express';
import { z } from 'zod';
import * as reportController from '../controllers/reportController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const formatSchema = z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json');

router.get(
  '/monthly',
  validate({
    query: z.object({
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
      format: formatSchema,
    }),
  }),
  reportController.monthly,
);

router.get(
  '/yearly',
  validate({
    query: z.object({
      year: z.string().regex(/^\d{4}$/).optional(),
      format: formatSchema,
    }),
  }),
  reportController.yearly,
);

router.get(
  '/categories',
  validate({
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      format: formatSchema,
    }),
  }),
  reportController.categories,
);

export default router;
