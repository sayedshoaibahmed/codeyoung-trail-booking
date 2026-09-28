import type { RequestHandler } from 'express';
import { AdminLoginRateLimitedError } from '../../domain/errors';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function createAdminLoginRateLimit(windowMs = WINDOW_MS, maxAttempts = MAX_ATTEMPTS): RequestHandler {
  const attempts = new Map<string, number[]>();

  return (req, _res, next) => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const recent = (attempts.get(key) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxAttempts) {
      next(new AdminLoginRateLimitedError());
      return;
    }
    recent.push(now);
    attempts.set(key, recent);
    next();
  };
}
