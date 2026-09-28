/**
 * Express router — /api/admin
 *
 *   POST /api/admin/login     — create HTTP-only session cookie
 *   POST /api/admin/logout    — clear session cookie
 *   GET  /api/admin/session   — current admin session
 *   GET  /api/admin/dashboard — read-only dashboard (auth required)
 */
import { Router } from 'express';
import { z } from 'zod';
import type { GetAdminDashboardUseCase } from '../../application/useCases/GetAdminDashboard';
import type { AuthenticateAdminUseCase } from '../../application/useCases/AuthenticateAdmin';
import type { AdminSessionService } from '../../application/ports/AdminAuth';
import { createRequireAdminAuth } from '../middleware/requireAdminAuth';
import { createAdminLoginRateLimit } from '../middleware/adminLoginRateLimit';
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  clearAdminCookieOptions,
  readCookie,
} from '../../infrastructure/auth/adminCookie';

const LoginBodySchema = z.object({
  username: z.string().min(1, 'username is required').max(200),
  password: z.string().min(1, 'password is required').max(200),
});

export interface AdminRouterDeps {
  getDashboard: GetAdminDashboardUseCase;
  authenticateAdmin: AuthenticateAdminUseCase;
  sessions: AdminSessionService;
  loginRateLimit?: ReturnType<typeof createAdminLoginRateLimit>;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAdminAuth(deps.sessions);
  const loginRateLimit = deps.loginRateLimit ?? createAdminLoginRateLimit();

  router.post('/login', loginRateLimit, (req, res, next) => {
    try {
      const parsed = LoginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
        return;
      }
      const { token } = deps.authenticateAdmin.execute(parsed.data);
      res.cookie(ADMIN_SESSION_COOKIE, token, adminCookieOptions());
      res.json({ authenticated: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    const token = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
    deps.sessions.revoke(token);
    res.clearCookie(ADMIN_SESSION_COOKIE, clearAdminCookieOptions());
    res.json({ authenticated: false });
  });

  router.get('/session', requireAuth, (_req, res) => {
    res.json({ authenticated: true });
  });

  router.get('/dashboard', requireAuth, async (_req, res, next) => {
    try {
      const data = await deps.getDashboard.execute();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
