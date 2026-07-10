import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

router.post(
  '/register',
  validate({
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      password: passwordSchema,
    }),
  }),
  authController.register,
);

router.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
      remember: z.boolean().optional(),
    }),
  }),
  authController.login,
);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.post(
  '/forgot-password',
  validate({ body: z.object({ email: z.string().email() }) }),
  authController.forgotPassword,
);

router.get('/me', requireAuth, authController.me);

router.put(
  '/profile',
  requireAuth,
  validate({
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      avatar: z.string().max(500).nullable().optional(),
      currentPassword: z.string().optional(),
      newPassword: passwordSchema.optional(),
    }),
  }),
  authController.updateProfile,
);

export default router;
