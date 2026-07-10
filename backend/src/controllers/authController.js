import * as authService from '../services/authService.js';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/api/auth',
    maxAge: config.refreshTokenTtlMs,
  });
}

export async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    setRefreshCookie(res, authService.signRefreshToken(user));
    res.status(201).json({ user, accessToken: authService.signAccessToken(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const user = await authService.login(req.body);
    setRefreshCookie(res, authService.signRefreshToken(user));
    res.json({ user, accessToken: authService.signAccessToken(user) });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new ApiError(401, 'No refresh token');
    const payload = authService.verifyRefreshToken(token);
    const user = await authService.getUserById(payload.sub);
    setRefreshCookie(res, authService.signRefreshToken(user));
    res.json({ user, accessToken: authService.signAccessToken(user) });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(401, 'Invalid refresh token'));
  }
}

export async function me(req, res, next) {
  try {
    res.json({ user: await authService.getUserById(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ message: 'Logged out' });
}

export async function updateProfile(req, res, next) {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res) {
  // Email delivery is out of scope; always respond success to avoid user enumeration.
  res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
}
