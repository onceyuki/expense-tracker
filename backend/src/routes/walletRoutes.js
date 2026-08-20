import { Router } from 'express';
import { z } from 'zod';
import * as walletController from '../controllers/walletController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const walletBody = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  initialBalance: z.number().optional(),
});

router.get('/', walletController.list);
router.post('/', validate({ body: walletBody }), walletController.create);
router.put('/:id', validate({ body: walletBody.partial() }), walletController.update);
router.delete('/:id', walletController.remove);

export default router;
