import { Router } from 'express';
import { z } from 'zod';
import * as categoryController from '../controllers/categoryController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex code like #2a78d6');

const createBody = z.object({
  name: z.string().trim().min(1).max(40),
  color: colorSchema.optional(),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  color: colorSchema.optional(),
});

router.get('/', categoryController.list);
router.post('/', validate({ body: createBody }), categoryController.create);
router.put('/:id', validate({ body: updateBody }), categoryController.update);
router.delete('/:id', categoryController.remove);

export default router;
