import { Router } from 'express';
import { z } from 'zod';
import * as dashboardController from '../controllers/dashboardController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

router.get(
  '/dashboard',
  requireAuth,
  validate({ query: z.object({ month: monthSchema.optional() }) }),
  dashboardController.dashboard,
);

router.get(
  '/analytics',
  requireAuth,
  validate({
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      granularity: z.enum(['week', 'month', 'year']).default('month'),
    }),
  }),
  dashboardController.analytics,
);

export default router;
