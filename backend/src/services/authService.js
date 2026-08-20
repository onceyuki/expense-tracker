import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { seedDefaultCategories } from './categoryService.js';
import { seedDefaultWallets } from './walletService.js';

export function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtRefreshSecret, {
    expiresIn: '7d',
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}

export async function register({ name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, 'An account with this email already exists');
  const user = await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 10) },
  });
  await seedDefaultCategories(user.id);
  await seedDefaultWallets(user.id);
  return sanitizeUser(user);
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  return sanitizeUser(user);
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, 'User not found');
  return sanitizeUser(user);
}

export async function updateProfile(userId, { name, email, avatar, currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found');

  const data = {};
  if (name !== undefined) data.name = name;
  if (avatar !== undefined) data.avatar = avatar;

  if (email !== undefined && email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new ApiError(409, 'An account with this email already exists');
    data.email = email;
  }

  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    data.password = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return sanitizeUser(updated);
}
